exports.handler = async (event) => {
  console.log('Function invoked');
  
  // ハードコードされた認証情報
  const authUsers = {
    'admin': 'password123',
    'user': 'secret456'
  };
  
  const request = event.Records[0].cf.request;
  console.log('Request headers:', JSON.stringify(request.headers));
  
  // 認証ヘッダーがない場合
  if (!request.headers.authorization) {
    console.log('No authorization header found');
    return {
      status: '401',
      statusDescription: 'Unauthorized',
      headers: {
        'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic realm="Restricted Area"' }],
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }]
      },
      body: 'Unauthorized'
    };
  }
  
  // 認証処理
  try {
    const authHeader = request.headers.authorization[0].value;
    console.log('Authorization header:', authHeader);
    
    const encodedCreds = authHeader.split(' ')[1];
    console.log('Encoded credentials:', encodedCreds);
    
    const decodedCreds = Buffer.from(encodedCreds, 'base64').toString();
    console.log('Decoded credentials:', decodedCreds);
    
    const [username, password] = decodedCreds.split(':');
    console.log('Username:', username);
    console.log('Password:', password);
    
    if (authUsers[username] === password) {
      console.log('Authentication successful');
      return request;
    }
    
    console.log('Invalid credentials');
    return {
      status: '401',
      statusDescription: 'Unauthorized',
      headers: {
        'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic realm="Restricted Area"' }],
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }]
      },
      body: 'Invalid credentials'
    };
  } catch (error) {
    console.error('Error in authentication process:', error);
    return {
      status: '500',
      statusDescription: 'Internal Server Error',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }]
      },
      body: 'Authentication error'
    };
  }
};