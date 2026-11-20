import argparse
import os
import socket
import sys
import threading

import uvicorn

from app.main import create_app


class SidecarServer(uvicorn.Server):
    async def startup(self, sockets: list[socket.socket] | None = None) -> None:
        await super().startup(sockets)
        if self.started and sockets:
            print(f"RUVOX_READY port={sockets[0].getsockname()[1]}", flush=True)


def watch_parent(server: SidecarServer) -> None:
    while sys.stdin is not None and os.read(sys.stdin.fileno(), 4096):
        pass
    server.should_exit = True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--host", choices=["127.0.0.1", "localhost"], default="127.0.0.1"
    )
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument(
        "--check-agents",
        action="store_true",
        help="load packaged agent classes before startup",
    )
    args = parser.parse_args()
    if args.check_agents:
        from agno.agent import Agent
        from agno.models.anthropic import Claude
        from agno.team import Team
        from anthropic import Anthropic

        print(
            "Loaded:",
            Agent.__name__,
            Team.__name__,
            Claude.__name__,
            Anthropic.__name__,
            file=sys.stderr,
        )
    config = uvicorn.Config(
        create_app(),
        host=args.host,
        port=args.port,
        proxy_headers=False,
        access_log=False,
        timeout_graceful_shutdown=5,
    )
    server = SidecarServer(config)
    with config.bind_socket() as listener:
        threading.Thread(target=watch_parent, args=(server,), daemon=True).start()
        server.run(sockets=[listener])


if __name__ == "__main__":
    main()
