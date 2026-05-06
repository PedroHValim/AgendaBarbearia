const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const supabase = require('../../config/supabase');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Gera token JWT
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ── CADASTRO ──────────────────────────────────────────
async function register(req, res) {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres' });
  }

  // Telefone só números
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return res.status(400).json({ error: 'Telefone inválido. Use formato: (11) 99999-9999' });
  }

  try {
    // Verifica se e-mail já existe
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: cleanPhone,
        password_hash: hashedPassword,
        role: 'client',
        auth_provider: 'email',
        is_active: true,
      })
      .select('id, name, email, phone, role')
      .single();

    if (error) throw error;

    const token = generateToken(user.id);

    return res.status(201).json({
      message: 'Conta criada com sucesso!',
      token,
      user,
    });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    return res.status(500).json({ error: 'Erro ao criar conta' });
  }
}

// ── LOGIN ─────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, password_hash, is_active, auth_provider')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta desativada. Entre em contato.' });
    }

    if (user.auth_provider === 'google') {
      return res.status(400).json({ error: 'Esta conta foi criada com Google. Use o botão "Entrar com Google".' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;

    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro ao fazer login' });
  }
}

// ── GOOGLE OAUTH ──────────────────────────────────────
// Fluxo: frontend envia o id_token do Google → backend verifica e loga/cadastra
async function googleLogin(req, res) {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'Token do Google não fornecido' });
  }

  try {
    // Verifica o token com o Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    // Verifica se usuário já existe
    let { data: user } = await supabase
      .from('users')
      .select('id, name, email, phone, role, is_active')
      .eq('email', email.toLowerCase())
      .single();

    if (user) {
      // Usuário já existe
      if (!user.is_active) {
        return res.status(403).json({ error: 'Conta desativada.' });
      }
      // Atualiza google_id se ainda não tinha
      await supabase
        .from('users')
        .update({ google_id: googleId, auth_provider: 'google' })
        .eq('id', user.id);
    } else {
      // Cria novo usuário Google
      // Obs: sem phone — ele precisará completar o cadastro
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          name,
          email: email.toLowerCase(),
          google_id: googleId,
          avatar_url: picture,
          role: 'client',
          auth_provider: 'google',
          is_active: true,
          phone: null, // usuário completa depois
        })
        .select('id, name, email, phone, role')
        .single();

      if (error) throw error;
      user = newUser;
    }

    const token = generateToken(user.id);

    // Se não tem telefone, sinaliza ao frontend para pedir
    const needsPhone = !user.phone;

    return res.json({ token, user, needsPhone });
  } catch (err) {
    console.error('Erro no Google OAuth:', err);
    return res.status(401).json({ error: 'Token do Google inválido ou expirado' });
  }
}

// ── ATUALIZAR PERFIL (incluindo telefone pós-Google) ──
async function updateProfile(req, res) {
  const { name, phone } = req.body;
  const userId = req.user.id;

  const cleanPhone = phone ? phone.replace(/\D/g, '') : null;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ name, phone: cleanPhone })
      .eq('id', userId)
      .select('id, name, email, phone, role')
      .single();

    if (error) throw error;

    return res.json({ message: 'Perfil atualizado!', user });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
}

// ── DADOS DO USUÁRIO LOGADO ──
async function getMe(req, res) {
  return res.json({ user: req.user });
}

module.exports = { register, login, googleLogin, updateProfile, getMe };
