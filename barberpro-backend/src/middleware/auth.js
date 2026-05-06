const jwt = require('jsonwebtoken');
const supabase = require('../../config/supabase');

// Verifica JWT e injeta req.user
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Busca o usuário no banco para garantir que ainda existe e está ativo
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta desativada' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Verifica se o usuário é admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
}

// Verifica se é admin OU o próprio usuário
function requireAdminOrSelf(req, res, next) {
  const targetId = req.params.userId || req.params.id;
  if (req.user.role === 'admin' || req.user.id === targetId) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso negado.' });
}

module.exports = { authenticate, requireAdmin, requireAdminOrSelf };
