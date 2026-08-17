# Agendamentos do MicroWork → painel e TV

## Como ficou o fluxo

1. A listagem continua sendo feita normalmente no **MicroWork Cloud DMS**.
2. O userscript lê somente as linhas que já estão visíveis na tabela e envia os dados ao site.
3. O site grava/atualiza cada registro pelo par **empresa + número do agendamento** — sincronizar de novo não duplica.
4. A área **Oficina → Agendamentos** mostra a agenda recebida.
5. A tela `/tv/agendamentos` atualiza sozinha a cada 45 segundos e destaca a próxima motocicleta.

O MicroWork continua sendo a fonte oficial. O banco do site funciona apenas como uma cópia operacional para a recepção.

## 1. Criar a tabela no Supabase

No Supabase do projeto, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase-agendamentos.sql` e execute.

## 2. Configurar as variáveis do site

Além das variáveis que o projeto já usa, configure no ambiente da hospedagem:

```text
SUPABASE_SERVICE_ROLE_KEY=chave_service_role_do_supabase
AGENDAMENTOS_SYNC_TOKEN=um_token_aleatorio_forte
TV_ACCESS_TOKEN=outro_token_aleatorio_forte
```

- Use valores diferentes, com pelo menos 24 caracteres.
- `SUPABASE_SERVICE_ROLE_KEY` e os tokens **não podem** começar com `NEXT_PUBLIC_`.
- Não coloque a service role dentro do userscript.
- No formulário do Netlify, preencha os campos separadamente:
  - **Key:** `AGENDAMENTOS_SYNC_TOKEN`
  - **Value:** somente o token secreto que você gerou (sem `AGENDAMENTOS_SYNC_TOKEN=` e sem espaços extras)
  - ative **Contains secret values** para proteger o valor.
- Não escreva `AGENDAMENTOS_SYNC_TOKEN=valor` inteiro dentro do campo **Key**.
- Depois de salvar ou alterar uma variável no Netlify, publique um **novo deploy** para que a função receba o valor.

O arquivo `.env.example` contém o modelo completo.

## 3. Instalar o coletor no Tampermonkey

Instale como um segundo userscript o arquivo:

```text
userscript/microwork-agendamentos-sync.user.js
```

Ele é separado do autofill para que uma atualização do coletor não arrisque o preenchimento automático de O.S.

Depois de instalar:

1. Abra o menu do Tampermonkey.
2. No script, clique em **Configurar sincronização de agendamentos**.
3. Informe `https://SEU-SITE/api/agendamentos/sync`.
4. Informe exatamente o mesmo valor de `AGENDAMENTOS_SYNC_TOKEN` configurado na hospedagem.

Se aparecer **“Não autorizado / 401”**, confira os campos **Key** e **Value** acima, faça o novo deploy e abra novamente o comando **Configurar sincronização de agendamentos** no Tampermonkey. Cole apenas o valor do token; nunca a `SUPABASE_SERVICE_ROLE_KEY`.

Na tela de listagem do MicroWork aparecerá um botão no canto inferior direito. A sincronização ocorre automaticamente quando a tabela muda e também pode ser forçada clicando nesse botão.

### Paginação

O coletor identifica quando a tela mostra, por exemplo, “1–10 de 25 itens”. Nesse caso ele avisa **10 de 25 sincronizados** e não remove registros antigos, porque a captura é parcial.

Para garantir uma agenda completa, use uma destas opções:

- aumente no Kendo Grid a quantidade de itens exibidos até mostrar todos; ou
- percorra as páginas e sincronize cada uma.

Para a agenda diária da oficina, normalmente todos os registros cabem em uma única página.

## 4. Ativar a TV da recepção

Na TV, abra uma única vez:

```text
https://SEU-SITE/tv/agendamentos/acesso?chave=VALOR_DE_TV_ACCESS_TOKEN
```

O site valida a chave, salva a autorização nesse navegador e redireciona para uma URL limpa. Depois disso, a TV pode abrir diretamente:

```text
https://SEU-SITE/tv/agendamentos
```

Também é possível abrir a tela pelo botão **Oficina → Agendamentos → Abrir modo TV** quando já estiver logado no painel.

## Privacidade da tela pública

A API da TV não envia telefone nem nome/placa completos. A visualização exibe o primeiro nome com inicial do último sobrenome e mascara os quatro caracteres finais da placa. Os dados completos permanecem restritos à tabela do servidor.

## Campos lidos da tabela do MicroWork

O coletor usa os índices reais do Kendo Grid enviados na inspeção:

| Índice | Campo |
| ---: | --- |
| 1 | Empresa |
| 2 | Nº do agendamento |
| 3 | Data/hora de início |
| 4 | Situação |
| 5 | Tipo de O.S. |
| 6 | Placa |
| 7 | Modelo |
| 8 | Pessoa |
| 9 | Telefone |
| 10 | Celular |
| 11 | Consultor |

Se o MicroWork alterar a ordem dessas colunas no futuro, ajuste os índices em `valorCelula(row, índice)` no userscript.
