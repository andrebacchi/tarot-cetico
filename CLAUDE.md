# Tarot Cético: guia de manutenção

App do BACCHI LAB (seção "Jogos e sátiras"). Leia também o `CLAUDE.md` do repositório `bacchilab`, que traz as regras gerais dos apps do André.
Publicação: GitHub Pages, branch `main`, raiz. Endereço: https://andrebacchi.github.io/tarot-cetico/

## Estrutura

- `src/` é a fonte. `sh build.sh` gera `index.html` e `sw.js` na raiz (os dois são arquivos gerados: não edite à mão).
  `sh build.sh artifact` gera `dist/artifact.html`, para pré-visualizar como artefato (sem instalação nem service worker; publique junto a pasta `cards/`).
- `cards/` tem as 81 cartas (450 × 720, WebP, em tom de pergaminho). `icons/` tem os ícones do app.
- `src/qr.svg`: QR code do endereço do app, embutido pelo build (botão "QR code" da capa). É fixo; foi gerado com o `qrcode.js` do repositório `bacchilab` (nível M).
- `tools/` tem os scripts que geraram os dados a partir do livro. Só são necessários se o texto ou as artes do livro mudarem.

## Onde fica cada texto

| Arquivo | Conteúdo | Origem |
|---|---|---|
| `src/cartas.json` | texto de cada carta | livro, literal (`tools/parse_book.py` lê `tools/livro.txt`) |
| `src/modos.json` | regras dos seis modos | livro, capítulo 1, literal (`tools/parse_modos.py`) |
| `src/leituras.json` | frases do modo Tarólogo: 27 arquétipos × passado, presente e futuro, e 36 falas do tarólogo | textos novos, revisados pelo André |
| `src/hoje.json` | "A carta de hoje": 7 aberturas por dia da semana e 63 textos (arquétipos, falácias e vieses) | textos novos |

O `build.py` falha se faltar texto para alguma carta. Nome da carta = o que está impresso nela; `livro` = título no livro.

## Toda atualização

- Aumente `VERSAO` no `build.py`: ela aparece no rodapé e dá nome ao cache do app (`tarot-cetico-app-<versão>`), então quem instalou recebe a versão nova.
  O cache das cartas e fontes (`FIXOS`) só muda se as imagens das cartas mudarem.
- Rode `sh build.sh` e publique `index.html` e `sw.js` junto com a fonte.
- Teste em 390 px e em 1280 px, sem rolagem horizontal. O proxy da sessão bloqueia `fonts.googleapis.com` e `github.io`:
  teste com `python3 -m http.server` + Playwright e peça ao André para conferir o site no ar.
- Commits com autor "André Demambre Bacchi".

## Como as coisas funcionam

- **Visual:** mesa de veludo ametista, cartas em pergaminho, filetes em latão. Fontes: Macondo (títulos; foi desenhada para um baralho de tarot),
  Alegreya (texto) e Alegreya Sans (rótulos). Cor no hub: `#6b3fa0`. O André aprovou este visual e as animações de embaralhar, tirar e virar.
- **A carta de hoje:** sai da data do aparelho, então no mesmo dia todo mundo recebe a mesma carta e o mesmo texto (é o experimento de Forer).
  As 63 cartas (sem os cenários) são reembaralhadas a cada 63 dias. A imagem para compartilhar (1080 × 1920) é desenhada em canvas.
- **Tarólogo:** o arquétipo é virado pelo usuário; a carta de falácia ou viés só sai quando ele toca em "Próximo" (pedido do André).
- **Modo Educativo:** sem servidor, mesma ideia do Bingo do Picareta. Código da turma = 4 caracteres ao acaso + 1 que indica o cenário.
  Código pessoal do aluno = 3 caracteres + 1 de conferência. Turma + código pessoal definem as cartas, e o professor as reconstrói pelo código.
  Alfabeto sem I, O, 0 e 1. Não mude a ordem das cartas em `cartas.json` nem as sementes sem necessidade: os códigos antigos deixam de bater.
- **No aparelho (localStorage, prefixo `tarot-cetico:`):** rascunho da Escrita Criativa, turma do Modo Educativo e a data da última carta do dia.
- **Service worker:** apaga só os caches com prefixo `tarot-cetico-` (todos os apps dividem a origem `andrebacchi.github.io`).

## Pendências de texto (decisão do André)

- O livro diz "Nutrólogo Ortomolecular" e a carta diz "Nutróloga".
- A descrição do Tio do Zap parece ter um "não" sobrando ("não é uma figura que se acha...").
- O cenário Vacinação Obrigatória cita "homem de palha", "falso dilema" e "apelo à natureza"; as cartas se chamam Espantalho, Falsa Dicotomia e Apelo ao Natural.
- Na folha original, a carta "Medicina Alternativa" vem cortada no topo; a moldura foi completada com a de outra carta (`tools/extract_cards.py`).
- A revelação do Tarólogo cita o experimento de Forer (1948, nota média 4,26 em 5), que não está no livro; o André confirmou.

## Próximos modos

Debate (cronômetros de 1 e 2 minutos, placar de 5 rodadas, dado opcional), Identificação de Falácias (grupos, 2 minutos, 6 palpites, 15 pontos)
e Tarólogo Cético em duplas. Todos reaproveitam a mesa, os montes e as animações que já existem em `src/app.js`.
