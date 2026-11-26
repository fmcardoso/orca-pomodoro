# Pomodoro 🍅 — um tomate de estimação para o Orca

Plugin do Orca com um timer Pomodoro que mora na barra de status e num painel animado na
barra lateral direita.

- **Barra de status:** `🍅 18:42 · 3` (tempo restante · pomodoros de hoje). Cor de destaque
  enquanto roda, neutra quando pausado/parado (`⏸` quando pausado), verde ao terminar
  (`🍅 Pronto! · 4`). Clique para abrir o painel.
- **Painel "pet":** um tomate em SVG com anel de progresso. Cara concentrada enquanto roda,
  dormindo (com "Zzz") quando pausado ou parado, e festejando com confete quando termina.
  Contagem regressiva, campo de minutos (padrão 25) com atalhos 25 / 50, botões
  **Iniciar/Pausar/Continuar** e **Resetar timer**, e **Hoje: N 🍅** com **Zerar dia** (pede
  confirmação com um segundo clique). Segue o tema claro/escuro do Orca.
- **Aviso:** ao fim de um pomodoro, notificação do sistema "Pomodoro concluído 🍅" com a contagem
  do dia. (Ainda não há timer de pausa.)

| Rodando | Pausado | Concluído | Escuro |
| --- | --- | --- | --- |
| ![](docs/screenshots/preview-panel-running.png) | ![](docs/screenshots/preview-panel-paused.png) | ![](docs/screenshots/preview-panel-finished.png) | ![](docs/screenshots/preview-panel-running-dark.png) |

> As imagens `preview-*` são o painel renderizado fora do Orca (Chromium, com variáveis de tema
> parecidas com as do Orca e um `orca` simulado). Capturas feitas dentro do Orca entram em
> `docs/screenshots/` quando o plugin for aprovado e carregado.

## Instalar e ativar

O plugin fica em `plugin/` (a raiz do repositório só tem docs e o TypeScript para checar
tipos). Carregue como pasta de desenvolvimento (chave `local.pomodoro`):

```sh
orca plugin dev load ~/playground/orca-pomodoro/plugin --json
```

Na primeira vez o Orca responde `approval_required` com a lista de acessos e um comando com
`--approve <fingerprint>`; confira e rode esse comando. Acessos pedidos:

- roda código próprio num processo Node (`trusted-worker`);
- `notifications:show` — notificação ao fim do pomodoro;
- `storage:own` — guarda o timer e a contagem diária;
- `settings:own` — lê a configuração `focusMinutes`.

Para desenvolver: `orca plugin dev watch plugin --check --shot plugin/.orca/shots --json`.

## Usar

- Clique no item `🍅` da barra de status, ou **Mod+Shift+P** (Cmd+Shift+P no macOS), para abrir o
  painel.
- Paleta de comandos: **Pomodoro: Iniciar/Pausar**, **Resetar timer**, **Zerar contagem do dia**,
  **Abrir Pomodoro**, **Foco 25 min**, **Foco 50 min**.
- Configurações → Pomodoro → **Minutos de foco** (`focusMinutes`, 1–180, padrão 25): duração
  usada quando o timer está parado.

## Como funciona

- O worker (`src/worker.ts`) é o dono do timer. O estado fica em `orca.storage` (chave
  `pomodoro`) como fatos de relógio — `endsAt` enquanto roda, `pausedRemainingMs` quando pausado —
  e nunca como contador de ticks. Por isso reiniciar o Orca ou recarregar o worker mantém o tempo
  certo; um pomodoro que acabou com o Orca fechado é contado uma vez (no dia em que terminou) e
  notificado uma vez quando o worker volta.
- A contagem é guardada por data local (`YYYY-MM-DD`), então vira sozinha à meia-noite.
- O worker atualiza a barra de status uma vez por segundo só enquanto roda, avisa os painéis
  abertos com `panels.post`, e o painel também escuta `storage.onDidChange`.
- Abrir o painel: o host não tem um método para isso, então o worker executa
  `orca plugin open <chave> --panel pomodoro` via `child_process` (CLI de `ORCA_CLI_COMMAND`, do
  bundle do app, ou `orca` no PATH), descobrindo a própria chave com `orca plugin list`.

## Desenvolvimento

```sh
npm install           # só o TypeScript, na raiz (fora da pasta do plugin)
cd plugin
npx tsc -p .
orca plugin test . --json
orca plugin validate . --json
orca plugin check . --json
```

Arquivos (em `plugin/`): `src/timer.ts` (lógica pura), `src/worker.ts`, `src/open-panel.ts`,
`src/panel.html` + `panel.css` + `panel-main.ts` (DOM) + `panel-view.ts` (lógica testável do
painel), testes em `src/*.test.ts`.
