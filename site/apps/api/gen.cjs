const jwt = require('jsonwebtoken');
console.log(jwt.sign({ sub: 6, role: 'user' }, 'dev-access-secret', { expiresIn: '1h' }));
