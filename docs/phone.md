# Using Ruvox on your phone

Ruvox runs on your computer. Your phone can open it over the home Wi-Fi while the
desktop app is running. Nothing is hosted anywhere else.

1. On the computer, open **Configurações** and turn on **Acesso pelo celular**.
   The app restarts by itself and shows an address like `http://192.168.0.12:8787/`
   and a 6-digit code.
2. On the phone (same Wi-Fi), open that address in the browser and type the code.
   Each code pairs one device. **Renovar código** shows a new one.
3. Optional: use the browser menu, **Adicionar à tela inicial**, to get an icon.
   Ruvox then opens without the address bar.

Things to know:

- Anyone you pair can use the app, including the API key you configured. Use
  **Desparear todos** in Configurações to cut every phone off.
- The connection is plain HTTP on your own network. Only addresses (not domain names)
  are accepted, and unpaired devices cannot use the API. Do not enable this on a
  network you do not trust.
- Browsers only run service workers, which give true offline install, on HTTPS or
  `localhost`. Ruvox therefore ships a manifest (icon, name, full screen) but no
  service worker. If you want a real HTTPS install, put the address behind
  `tailscale serve` or a local certificate from `mkcert` and open that HTTPS address.
- The desktop app must be running. If the phone cannot connect, check the address
  and that the computer's firewall allows the port shown in Configurações.
