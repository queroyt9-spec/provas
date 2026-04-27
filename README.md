# Projeto: Banco de Provas FURB/SED-SC + Treinador de Questões/Flashcards

## 1. Objetivo
Criar uma ferramenta de estudo para o concurso da SED/SC 2026, banca FURB, voltada inicialmente para Pedagogia/Professor – Anos Iniciais do Ensino Fundamental.

A ferramenta terá dois módulos:

1. **Biblioteca de provas**: catálogo pesquisável de provas antigas da FURB, especialmente SED/SC e cargos de educação/pedagogia.
2. **Treinador de questões e flashcards**: importa questões padronizadas em JSON/CSV, aplica simulados, registra erros e transforma erros em flashcards de revisão.

Recomendação: começar como **um único projeto web/PWA com dois módulos**, e não dois sites separados. Isso evita duplicar login, banco de dados, importação e controle de progresso.

---

## 2. Contexto confirmado do concurso
Fontes oficiais/relevantes identificadas:

- Página oficial FURB: Concurso Público SED/SC Professor, Edital nº 793/SED/2026.
- Edital oficial: Concurso Público do cargo de Professor, Edital nº 793/SED/2026.
- Página oficial FURB do concurso SED/SC 2024, com links para provas e gabaritos.
- PCI Concursos possui índice de provas FURB e professor FURB, útil como fonte secundária para localizar PDFs antigos.

Pontos importantes do edital 793/SED/2026:

- Concurso para Professor do Quadro do Magistério Público Estadual de Santa Catarina.
- Banca: FURB.
- Inscrições: 30/03/2026 a 28/04/2026.
- Prova objetiva: 24/05/2026.
- Publicação dos cadernos de questões e gabarito preliminar: 25/05/2026.
- Para 1 componente curricular: 40 questões.
  - 10 Conhecimentos Gerais.
  - 10 Metodologia da Prática Docente.
  - 20 Conhecimentos Específicos.
- Mínimo para aprovação: 6,00 pontos na prova objetiva por componente curricular.

---

## 3. Decisão de arquitetura

### Melhor abordagem inicial
Criar **um único app**, com duas áreas:

```text
/app
  /biblioteca-provas
  /treinar-questoes
  /flashcards
  /importar
```

Motivo:

- O mesmo banco de questões alimenta simulados e flashcards.
- A mãe do usuário terá uma experiência simples: procurar questão, responder, revisar erro.
- Menor complexidade técnica.
- Mais fácil transformar em PWA instalável no celular.

### Separação interna
Mesmo sendo um app só, o código pode ficar modular:

```text
sed-sc-furb-study/
  apps/
    web/
  packages/
    parser/
    question-schema/
    spaced-repetition/
  data/
    sources/
    raw_pdfs/
    processed_json/
```

---

## 4. MVP recomendado

### MVP 1 — Biblioteca manual/semiautomática de provas
Objetivo: guardar links, nomes, cargos, anos, banca e órgão.

Funcionalidades:

- Cadastro manual de prova.
- Campos: ano, banca, órgão, cargo, área, URL da prova, URL do gabarito, fonte, tags.
- Filtro por banca FURB, SED/SC, professor, anos iniciais, pedagogia, educação especial etc.
- Download opcional ou apenas link externo.

Não começar com scraping agressivo. Começar com catálogo curado.

### MVP 2 — Importação padronizada de questões
Objetivo: colar/mandar para o ChatGPT o PDF ou texto da prova e receber um JSON padronizado.

O app não precisa entender PDF no início. Ele só precisa importar JSON/CSV válido.

### MVP 3 — Treino de questões
Funcionalidades:

- Escolher assunto/fonte/ano.
- Responder questões de múltipla escolha.
- Mostrar gabarito após responder.
- Salvar acertos, erros, data e número de tentativas.
- Listar questões erradas.

### MVP 4 — Flashcards automáticos dos erros
Quando errar uma questão:

- Criar flashcard automaticamente.
- Frente: enunciado resumido ou pergunta conceitual.
- Verso: alternativa correta + explicação curta, se houver.
- Status inicial: “novo”.
- Revisão simples: errei / difícil / bom / fácil.

---

## 5. Fluxo de trabalho ideal

```text
1. Encontrar prova antiga
   ↓
2. Salvar metadados no catálogo
   ↓
3. Baixar PDF ou copiar texto
   ↓
4. Usar prompt no ChatGPT para converter em JSON
   ↓
5. Importar JSON no app
   ↓
6. Resolver questões
   ↓
7. Questões erradas viram flashcards
   ↓
8. Revisão espaçada
```

---

## 6. Modelo de dados simples

### Exam / Prova

```json
{
  "id": "furb_sed_sc_2024_prof_anos_iniciais",
  "title": "Professor - Anos Iniciais do Ensino Fundamental",
  "year": 2024,
  "board": "FURB",
  "agency": "SED/SC",
  "role": "Professor",
  "area": "Anos Iniciais do Ensino Fundamental",
  "source_url": "",
  "answer_key_url": "",
  "tags": ["FURB", "SED/SC", "Pedagogia", "Anos Iniciais"]
}
```

### Question / Questão

```json
{
  "id": "furb_sed_sc_2024_anos_iniciais_q001",
  "exam_id": "furb_sed_sc_2024_prof_anos_iniciais",
  "number": 1,
  "area": "Conhecimentos Gerais",
  "topic": "Legislação educacional",
  "statement": "Texto completo do enunciado...",
  "alternatives": {
    "A": "Alternativa A",
    "B": "Alternativa B",
    "C": "Alternativa C",
    "D": "Alternativa D",
    "E": "Alternativa E"
  },
  "correct_answer": "C",
  "explanation": "",
  "source_page": null,
  "tags": ["legislação", "educação"]
}
```

### Attempt / Tentativa

```json
{
  "question_id": "furb_sed_sc_2024_anos_iniciais_q001",
  "selected_answer": "A",
  "is_correct": false,
  "answered_at": "2026-04-26T10:00:00-03:00"
}
```

### Flashcard

```json
{
  "id": "card_furb_sed_sc_2024_anos_iniciais_q001",
  "question_id": "furb_sed_sc_2024_anos_iniciais_q001",
  "front": "Qual é a ideia central cobrada nesta questão?",
  "back": "Resposta correta: C. Explicação: ...",
  "status": "new",
  "due_at": "2026-04-27T10:00:00-03:00",
  "interval_days": 1,
  "ease": 2.5
}
```

---

## 7. Formato de importação recomendado

Começar com JSON. Depois adicionar CSV.

Arquivo:

```text
processed_json/furb_sed_sc_2024_anos_iniciais.json
```

Estrutura:

```json
{
  "exam": {
    "id": "furb_sed_sc_2024_prof_anos_iniciais",
    "title": "Professor - Anos Iniciais do Ensino Fundamental",
    "year": 2024,
    "board": "FURB",
    "agency": "SED/SC",
    "role": "Professor",
    "area": "Anos Iniciais do Ensino Fundamental",
    "tags": ["FURB", "SED/SC", "Pedagogia", "Anos Iniciais"]
  },
  "questions": [
    {
      "number": 1,
      "area": "Conhecimentos Gerais",
      "topic": "",
      "statement": "",
      "alternatives": {
        "A": "",
        "B": "",
        "C": "",
        "D": "",
        "E": ""
      },
      "correct_answer": "",
      "explanation": ""
    }
  ]
}
```

---

## 8. Prompt para transformar prova em JSON

Use este prompt no ChatGPT, anexando o PDF ou colando o texto da prova e o gabarito:

```text
Você é um extrator de questões de concurso.

Transforme a prova anexada/colada em um JSON válido, seguindo exatamente o esquema abaixo.

Regras:
1. Não invente alternativas, enunciados ou gabaritos.
2. Se uma questão estiver ilegível, marque "needs_review": true.
3. Preserve o texto do enunciado e das alternativas o máximo possível.
4. Classifique cada questão em uma destas áreas, quando possível:
   - Conhecimentos Gerais
   - Metodologia da Prática Docente
   - Conhecimentos Específicos
5. Se não souber o tópico, deixe "topic": "".
6. Use alternativas A, B, C, D, E.
7. A saída deve ser apenas JSON válido, sem comentários fora do JSON.

Esquema:
{
  "exam": {
    "id": "",
    "title": "",
    "year": 0,
    "board": "FURB",
    "agency": "",
    "role": "",
    "area": "",
    "tags": []
  },
  "questions": [
    {
      "number": 1,
      "area": "",
      "topic": "",
      "statement": "",
      "alternatives": {
        "A": "",
        "B": "",
        "C": "",
        "D": "",
        "E": ""
      },
      "correct_answer": "",
      "explanation": "",
      "needs_review": false
    }
  ]
}
```

---

## 9. Prompt para gerar explicação sem API paga

Quando a usuária errar, o app pode mostrar um botão “copiar prompt para ChatGPT”.

Modelo:

```text
Explique de forma simples por que errei esta questão de concurso da banca FURB.

Contexto: Concurso SED/SC para Professor/Pedagogia.

Questão:
[colar enunciado]

Alternativas:
A) ...
B) ...
C) ...
D) ...
E) ...

Minha resposta: [letra]
Gabarito: [letra]

Quero:
1. Por que a alternativa correta está certa.
2. Por que minha alternativa está errada.
3. Qual conceito eu preciso memorizar.
4. Um flashcard curto no formato:
Frente: ...
Verso: ...
```

---

## 10. Stack técnica recomendada

### Opção mais simples e rápida

- **Next.js + TypeScript**
- **TailwindCSS**
- **IndexedDB/Dexie.js** para armazenamento local no navegador
- Exportação/importação de backup em JSON
- PWA instalável no celular

Vantagens:

- Não precisa servidor no início.
- Não precisa login.
- Não tem custo de API.
- Pode rodar localmente ou no Vercel.

### Opção com banco online

- Next.js + TypeScript
- Supabase/Postgres
- Login por e-mail
- Tabelas: exams, questions, attempts, flashcards

Vantagem: sincroniza entre computador e celular.
Desvantagem: aumenta complexidade.

Recomendação inicial: começar local-first com IndexedDB. Depois migrar para Supabase se fizer falta.

---

## 11. Tarefas para o Codex/Cursor

### Fase 1 — Estrutura do app

```text
Crie um app Next.js com TypeScript e TailwindCSS chamado sed-sc-furb-study.
O app deve ter navegação com quatro páginas:
1. Biblioteca de Provas
2. Importar Questões
3. Resolver Questões
4. Flashcards
Use componentes simples, layout responsivo e persistência local com IndexedDB usando Dexie.js.
```

### Fase 2 — Banco local

```text
Implemente um banco local com Dexie.js contendo as tabelas:
- exams
- questions
- attempts
- flashcards
Crie types TypeScript para cada entidade.
Crie funções de CRUD para importar provas e questões a partir de JSON.
```

### Fase 3 — Importador

```text
Crie uma página de importação onde o usuário cola um JSON no padrão definido.
Valide o JSON.
Mostre um preview da prova e das questões.
Ao confirmar, salve no IndexedDB.
Evite duplicar questões com o mesmo exam_id + number.
```

### Fase 4 — Resolver questões

```text
Crie uma tela para resolver questões.
Permita filtrar por prova, ano, área e tags.
Exiba uma questão por vez com alternativas A-E.
Ao responder, informe se acertou ou errou.
Salve a tentativa.
Se errar, crie automaticamente um flashcard vinculado à questão.
```

### Fase 5 — Flashcards

```text
Crie uma tela de revisão de flashcards.
Mostre frente e verso.
Permita marcar: errei, difícil, bom, fácil.
Implemente revisão espaçada simples:
- errei: revisar amanhã
- difícil: revisar em 2 dias
- bom: revisar em 4 dias
- fácil: revisar em 7 dias
Atualize due_at conforme a resposta.
```

### Fase 6 — Prompt de explicação

```text
Na tela da questão respondida incorretamente, adicione um botão "Copiar prompt para ChatGPT".
O prompt deve incluir enunciado, alternativas, resposta marcada e gabarito.
O objetivo é pedir explicação sem integrar API paga.
```

---

## 12. Fontes iniciais para montar o catálogo

Pesquisar e catalogar primeiro:

1. Página oficial FURB do concurso SED/SC Professor 2026.
2. Página oficial FURB do concurso SED/SC 2024, com provas e gabaritos.
3. Índice PCI Concursos: Professor FURB.
4. Índice PCI Concursos: FURB geral.
5. PDFs de provas FURB/SED-SC para Professor Anos Iniciais, Educação Especial, Administração Escolar, Orientação/Supervisão, quando existirem.

Critérios de prioridade:

1. FURB + SED/SC + Professor Anos Iniciais.
2. FURB + SED/SC + Educação/Pedagogia.
3. FURB + prefeituras de SC + Pedagogia/Professor.
4. Outras bancas apenas para conteúdo, não para estilo da FURB.

---

## 13. Cuidados importantes

- Guardar a fonte original de cada questão.
- Não vender ou publicar banco de questões de terceiros sem verificar direitos autorais.
- Para uso pessoal/familiar, o risco é menor, mas ainda é melhor armazenar metadados e links, não redistribuir PDFs.
- Sempre revisar o JSON gerado pelo ChatGPT antes de importar em massa.
- Criar campo `needs_review` para questões duvidosas.
- Não confiar 100% no OCR ou na extração automática de PDF.

---

## 14. Próximo passo prático

1. Confirmar o cargo exato da mãe:
   - Professor – Anos Iniciais do Ensino Fundamental? SIM
   - Educação Especial/AEE? NAO
   - Outro componente? NAO
2. Montar uma lista inicial de 20 a 50 provas prioritárias.
3. Criar o app com importação manual por JSON.
4. Importar 1 prova antiga como teste.
5. Ajustar a experiência de resolução e flashcards.
6. Depois pensar em automação de busca/download.
