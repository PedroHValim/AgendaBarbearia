# 🔐 Guia: Google OAuth2 para o BarberPro

Este guia cobre tudo do zero — da criação do projeto no Google Cloud
até o botão funcionando no frontend.

---

## PARTE 1 — Google Cloud Console (5–10 minutos)

### Passo 1: Criar o projeto

1. Acesse: https://console.cloud.google.com
2. Clique em **"Select a project"** (canto superior esquerdo)
3. Clique em **"New Project"**
4. Nome: `BarberPro` → **Create**
5. Aguarde e selecione o projeto criado

---

### Passo 2: Ativar a Google Identity API

1. No menu lateral: **APIs & Services → Library**
2. Pesquise: `Google Identity`
3. Clique em **"Google Identity Toolkit API"** → **Enable**

---

### Passo 3: Criar a tela de consentimento OAuth

1. Menu: **APIs & Services → OAuth consent screen**
2. Selecione **"External"** → **Create**
3. Preencha:
   - **App name**: `BarberPro`
   - **User support email**: seu e-mail
   - **Developer contact**: seu e-mail
4. Clique em **Save and Continue** (nas próximas telas também)
5. Na etapa **"Test users"** (enquanto em desenvolvimento):
   - Adicione seu e-mail pessoal para testar

---

### Passo 4: Criar as credenciais OAuth

1. Menu: **APIs & Services → Credentials**
2. **"+ Create Credentials" → "OAuth Client ID"**
3. Application type: **Web application**
4. Name: `BarberPro Web`
5. Em **"Authorized JavaScript origins"**, adicione:
   ```
   http://localhost:5500
   http://127.0.0.1:5500
   ```
   (adicione sua URL de produção quando tiver)

6. Em **"Authorized redirect URIs"**, adicione:
   ```
   http://localhost:3001/api/auth/google/callback
   ```

7. Clique em **Create**
8. Uma janela abrirá com:
   - **Client ID**: `XXXXXXXXXXXX.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-XXXXXXXXXXXX`

9. Copie ambos e cole no seu arquivo `.env`:
   ```
   GOOGLE_CLIENT_ID=XXXXXXXXXXXX.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-XXXXXXXXXXXX
   ```

---

## PARTE 2 — Como funciona o fluxo no código

O BarberPro usa o fluxo **"Google Sign-In for Web"** (mais simples que OAuth code flow):

```
Frontend                          Backend                    Google
   |                                 |                          |
   |-- Usuário clica "Entrar c/ Google"                        |
   |-- Abre popup do Google -------->|                          |
   |                                 |<-- Google retorna -------|
   |                                 |    um "id_token" JWT     |
   |-- Envia id_token para backend ->|                          |
   |                                 |-- Verifica token ------->|
   |                                 |<-- Token válido ---------|
   |                                 |-- Cria/busca user        |
   |<-- Retorna JWT da sua API ------|                          |
   |-- Salva token, usuário logado   |                          |
```

---

## PARTE 3 — Adicionar no Frontend (barbearia.html)

Substitua o botão Google atual e adicione este script ao final do `<body>`:

### 3.1 — Adicione no `<head>` do barbearia.html:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### 3.2 — Substitua a função `googleAuth()` no script:

```javascript
// Substitua a função googleAuth() existente por esta:
function googleAuth() {
  google.accounts.id.initialize({
    client_id: 'COLE_SEU_GOOGLE_CLIENT_ID_AQUI',
    callback: handleGoogleCredential,
  });

  google.accounts.id.prompt(); // abre o popup do Google
}

async function handleGoogleCredential(response) {
  // response.credential é o id_token do Google
  try {
    const res = await fetch('http://localhost:3001/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: response.credential }),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao entrar com Google', 'error');
      return;
    }

    // Salva o token JWT da sua API
    localStorage.setItem('barberpro_token', data.token);
    localStorage.setItem('barberpro_user', JSON.stringify(data.user));

    // Se usuário não tem telefone (veio pelo Google), pede para completar
    if (data.needsPhone) {
      showToast('Quase lá! Complete seu cadastro com o telefone.', 'info');
      showPage('page-account');
      // Abre um modal/campo pedindo o telefone...
    } else {
      showPage('page-account');
      showToast('Login com Google realizado!', 'success');
    }
  } catch (err) {
    showToast('Erro de conexão com o servidor', 'error');
  }
}
```

### 3.3 — Atualize as funções de login/cadastro para usar o token:

```javascript
// Após doLogin() bem-sucedido, salve assim:
async function doLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-pass').value;
  if (!email || !password) { showToast('Preencha todos os campos', 'error'); return; }

  try {
    const res = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }

    localStorage.setItem('barberpro_token', data.token);
    localStorage.setItem('barberpro_user', JSON.stringify(data.user));
    showPage('page-account');
    showToast('Login realizado!', 'success');
  } catch (err) {
    showToast('Erro de conexão', 'error');
  }
}

// Helper: inclui o token em todas as requisições autenticadas
function authHeaders() {
  const token = localStorage.getItem('barberpro_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}
```

---

## PARTE 4 — Testando

1. Inicie o backend: `npm run dev`
2. Abra o `barbearia.html` com Live Server (porta 5500)
3. Clique em "Entrar com Google"
4. Faça login com a conta que você adicionou como Test User
5. No terminal do backend você verá os logs

### Verificar se funcionou:
- O backend retorna `{ token, user }` → ✅ funcionou
- O erro `"Token do Google inválido"` → Client ID errado no frontend ou backend
- O popup não abre → Script do Google não carregou

---

## PARTE 5 — Produção (quando chegar lá)

Quando for publicar o site:

1. Volte ao Google Cloud Console → Credentials
2. Edite o OAuth Client ID
3. Adicione as URLs reais em "Authorized JavaScript origins":
   ```
   https://seusite.com.br
   ```
4. Em "Authorized redirect URIs":
   ```
   https://seuapi.com/api/auth/google/callback
   ```
5. No Google Console → OAuth consent screen → **"Publish App"**
   (tira do modo de teste, libera para qualquer usuário Google)

---

## Resumo das variáveis que você precisa

```env
GOOGLE_CLIENT_ID=XXXXXXXXXXXX.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-XXXXXXXXXXXX   # só no backend, nunca no frontend!
```

O Client Secret **nunca vai para o frontend**. Ele fica só no `.env` do backend.
