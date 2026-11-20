# Guia do Ruvox

Ruvox ensina russo a quem fala português do Brasil, começando pelo alfabeto cirílico.
Tudo roda no seu computador: seus dados ficam num arquivo local e nada é hospedado.

## Instalar

- **Debian/Ubuntu**: `sudo apt install ./Ruvox_<versão>_amd64.deb` e abra "Ruvox" no menu.
- **AppImage**: `chmod +x Ruvox_<versão>_amd64.AppImage` e execute o arquivo.

Os instaladores ficam na página de *Releases* do repositório. Se você roda pelo código,
veja o README (`make dev`).

## Jogar sem chave de API

Sem chave, o Ruvox funciona em **modo offline**: alfabeto, palavras, digitação, cartões,
pares e lacunas, com repetição espaçada. A IA não é chamada e nada custa.

1. Em **Jogar**, escolha o tamanho da sessão e o modo e toque em **Começar**.
2. Responda. O app explica cada resposta e traz de volta, mais cedo, o que você errou.
3. Em **Alfabeto** você revisa as 33 letras e a pronúncia aproximada para brasileiros.

As letras liberam por grupos (iguais ao português, parecidas com letras latinas, novas)
e as palavras liberam quando você já viu todas as letras que elas usam.

## Modos de jogo

| Modo | O que faz |
| --- | --- |
| Misto | Letra → som, som → letra e palavra → significado |
| Digitação | Você digita em cirílico (há um teclado russo na tela) |
| Cartões | Vire o cartão e diga se sabia ou errou |
| Pares | Ligue palavras e significados em 60 segundos |
| Lacuna | Complete um trecho de uma das suas músicas |

## Usar a IA (opcional)

Em **Configurações**, cole sua chave da API da Anthropic e toque em **Testar conexão**.
Com chave, o app planeja a sessão e escreve as perguntas com IA e corrige respostas
digitadas quase certas, explicando o erro. Cada chamada tem custo; o tamanho dele aparece
nos registros (veja `docs/llm.md`). Se a IA falhar, o jogo continua no modo offline.

A chave fica num arquivo só seu, nunca é exibida de volta e nunca entra em backups.

## Músicas

1. Em **Músicas**, cole o título e a letra (até 20.000 caracteres). A letra fica só no seu
   computador.
2. Toque em **Analisar** (precisa de chave). A IA lista palavras, expressões e pontos de
   gramática. Desmarque o que não quiser e toque em **Salvar selecionadas**.
3. Use **Treinar esta música** ou o modo **Lacuna**.

Apagar uma música apaga também as palavras dela e o seu progresso nelas.

## Progresso e sequência

**Progresso** mostra quantos itens estão novos, em aprendizado, familiares e dominados, e
a atividade dos últimos 30 dias. A sequência conta dias seguidos com pelo menos uma sessão
de 5 respostas ou mais.

## Usar no celular

Veja `docs/phone.md`: ative **Acesso pelo celular**, abra o endereço mostrado no navegador
do celular e digite o código de 6 dígitos. O computador precisa estar com o app aberto.

## Backup

Em **Configurações > Seus dados**: **Exportar backup** salva um arquivo JSON com músicas,
progresso e histórico (sem a chave da API). **Importar backup** substitui tudo o que você
tem agora. **Apagar meu progresso** zera progresso, sessões e músicas.

## Problemas comuns

- **A janela não abre / fica em "Iniciando"**: feche o app, abra de novo; se persistir, rode
  `ruvox-backend` pelo terminal para ver a mensagem de erro.
- **A IA não responde**: use **Testar conexão**; confira a chave e a conexão. O app segue
  funcionando offline.
- **O celular não conecta**: mesmo Wi-Fi, endereço exato mostrado no computador e porta
  liberada no firewall.
