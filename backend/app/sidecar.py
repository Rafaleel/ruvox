import argparse
import os
import socket
import sys
import threading

import uvicorn

from app.config import read_settings
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


def port_is_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((host, port))
        except OSError:
            return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--host",
        choices=["127.0.0.1", "localhost", "0.0.0.0"],
        help="default: 127.0.0.1, or 0.0.0.0 when phone access is enabled",
    )
    parser.add_argument(
        "--port", type=int, help="default: any free port, or the saved LAN port"
    )
    parser.add_argument(
        "--no-stdin-watch",
        action="store_true",
        help="keep running when stdin closes (background dev servers)",
    )
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
        from langchain_groq import ChatGroq
        from langchain_openai import ChatOpenAI

        print(
            "Loaded:",
            Agent.__name__,
            Team.__name__,
            Claude.__name__,
            Anthropic.__name__,
            ChatOpenAI.__name__,
            ChatGroq.__name__,
            file=sys.stderr,
        )
    saved = read_settings()
    lan = saved.lan_enabled
    host = args.host or ("0.0.0.0" if lan else "127.0.0.1")
    port = args.port if args.port is not None else (saved.lan_port if lan else 0)
    if lan and args.port is None and not port_is_free(host, port):
        # The saved port is taken: start on any free port rather than failing every launch
        # (the app would only show its error page and Settings could never turn LAN off).
        print(f"Port {port} is busy; using a free port instead.", file=sys.stderr)
        port = 0
    app = create_app(lan=lan)
    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        proxy_headers=False,
        access_log=False,
        timeout_graceful_shutdown=5,
    )
    server = SidecarServer(config)
    with config.bind_socket() as listener:
        app.state.port = listener.getsockname()[1]  # what the phone must really use
        if not args.no_stdin_watch:
            threading.Thread(target=watch_parent, args=(server,), daemon=True).start()
        server.run(sockets=[listener])


if __name__ == "__main__":
    main()
