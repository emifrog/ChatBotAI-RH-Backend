// Script de diagnostic complet pour vérifier la connexion Frontend ↔ Backend

const axios = require('axios');
const io = require('socket.io-client');
const chalk = require('chalk');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Couleurs pour le terminal
const success = chalk.green;
const error = chalk.red;
const warning = chalk.yellow;
const info = chalk.blue;

// Données de test
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User'
};

// Classe de diagnostic
class ConnectionDiagnostic {
  constructor() {
    this.results = {
      backend: { status: 'pending', details: {} },
      auth: { status: 'pending', details: {} },
      socket: { status: 'pending', details: {} },
      api: { status: 'pending', details: {} },
      integration: { status: 'pending', details: {} }
    };
    this.token = null;
    this.userId = null;
  }

  async run() {
    console.log(info('\n🔍 Diagnostic de Connexion Frontend ↔ Backend\n'));
    console.log(info(`Backend URL: ${BACKEND_URL}`));
    console.log(info(`Frontend URL: ${FRONTEND_URL}\n`));

    await this.testBackendHealth();
    await this.testAuthentication();
    await this.testSocketConnection();
    await this.testAPIEndpoints();
    await this.testFullIntegration();

    this.printSummary();
  }

  // 1. Test Backend Health
  async testBackendHealth() {
    console.log(warning('\n📡 Test 1: Backend Health Check'));
    
    try {
      const response = await axios.get(`${BACKEND_URL}/health`);
      
      this.results.backend.status = 'success';
      this.results.backend.details = {
        statusCode: response.status,
        services: response.data.services,
        timestamp: response.data.timestamp
      };
      
      console.log(success('✅ Backend is running'));
      console.log(info(`   Status: ${response.status}`));
      console.log(info(`   Database: ${response.data.services?.database || 'unknown'}`));
      console.log(info(`   Redis: ${response.data.services?.redis || 'unknown'}`));
      
    } catch (err) {
      this.results.backend.status = 'failed';
      this.results.backend.details = { error: err.message };
      
      console.log(error('❌ Backend Health Check Failed'));
      console.log(error(`   Error: ${err.message}`));
      
      if (err.code === 'ECONNREFUSED') {
        console.log(warning('   → Make sure backend is running on port 5000'));
      }
    }
  }

  // 2. Test Authentication
  async testAuthentication() {
    console.log(warning('\n🔐 Test 2: Authentication'));
    
    if (this.results.backend.status !== 'success') {
      console.log(warning('⏭️  Skipping: Backend not available'));
      return;
    }

    try {
      // Test Registration (optional)
      try {
        await axios.post(`${BACKEND_URL}/api/auth/register`, testUser);
        console.log(info('   User registered (or already exists)'));
      } catch (err) {
        // User might already exist, continue
      }

      // Test Login
      const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });

      this.token = loginResponse.data.token;
      this.userId = loginResponse.data.user?.id;

      this.results.auth.status = 'success';
      this.results.auth.details = {
        tokenReceived: !!this.token,
        userIdReceived: !!this.userId,
        tokenLength: this.token?.length
      };

      console.log(success('✅ Authentication successful'));
      console.log(info(`   Token received: ${this.token ? 'Yes' : 'No'}`));
      console.log(info(`   User ID: ${this.userId || 'Not provided'}`));

      // Test Token Validation
      const profileResponse = await axios.get(`${BACKEND_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      console.log(success('✅ Token validation successful'));
      console.log(info(`   User: ${profileResponse.data.name || profileResponse.data.email}`));

    } catch (err) {
      this.results.auth.status = 'failed';
      this.results.auth.details = { error: err.response?.data?.message || err.message };
      
      console.log(error('❌ Authentication Failed'));
      console.log(error(`   Error: ${err.response?.data?.message || err.message}`));
    }
  }

  // 3. Test Socket.IO Connection
  async testSocketConnection() {
    console.log(warning('\n🔌 Test 3: Socket.IO Connection'));
    
    if (!this.token) {
      console.log(warning('⏭️  Skipping: No authentication token'));
      return;
    }

    return new Promise((resolve) => {
      const socket = io(BACKEND_URL, {
        auth: { token: this.token },
        transports: ['websocket'],
        timeout: 5000
      });

      const timeout = setTimeout(() => {
        this.results.socket.status = 'failed';
        this.results.socket.details = { error: 'Connection timeout' };
        console.log(error('❌ Socket.IO connection timeout'));
        socket.disconnect();
        resolve();
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        this.results.socket.status = 'success';
        this.results.socket.details = {
          connected: true,
          id: socket.id,
          transport: socket.io.engine.transport.name
        };

        console.log(success('✅ Socket.IO connected'));
        console.log(info(`   Socket ID: ${socket.id}`));
        console.log(info(`   Transport: ${socket.io.engine.transport.name}`));

        // Test sending a message
        socket.emit('send_message', {
          message: 'Test message from diagnostic',
          conversationId: 'test-diagnostic'
        });

        socket.on('receive_message', (data) => {
          console.log(success('✅ Message exchange successful'));
          console.log(info(`   Response received: ${data.botMessage?.content?.substring(0, 50)}...`));
          socket.disconnect();
          resolve();
        });

        socket.on('error', (err) => {
          console.log(error(`❌ Socket error: ${err.message}`));
          socket.disconnect();
          resolve();
        });
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        this.results.socket.status = 'failed';
        this.results.socket.details = { error: err.message };
        console.log(error('❌ Socket.IO connection failed'));
        console.log(error(`   Error: ${err.message}`));
        resolve();
      });
    });
  }

  // 4. Test API Endpoints
  async testAPIEndpoints() {
    console.log(warning('\n🌐 Test 4: API Endpoints'));
    
    if (!this.token) {
      console.log(warning('⏭️  Skipping: No authentication token'));
      return;
    }

    const endpoints = [
      { name: 'Conversations', method: 'GET', url: '/api/chat/conversations' },
      { name: 'Leave Balance', method: 'GET', url: '/api/leaves/balance' },
      { name: 'Payslips', method: 'GET', url: '/api/payslips' },
      { name: 'Training Catalog', method: 'GET', url: '/api/training/catalog' }
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${BACKEND_URL}${endpoint.url}`,
          headers: { Authorization: `Bearer ${this.token}` }
        });

        results.push({ ...endpoint, status: 'success', statusCode: response.status });
        console.log(success(`✅ ${endpoint.name}: ${response.status} OK`));
      } catch (err) {
        results.push({ 
          ...endpoint, 
          status: 'failed', 
          error: err.response?.status || err.message 
        });
        console.log(error(`❌ ${endpoint.name}: ${err.response?.status || err.message}`));
      }
    }

    this.results.api.status = results.every(r => r.status === 'success') ? 'success' : 'partial';
    this.results.api.details = { endpoints: results };
  }

  // 5. Test Full Integration Flow
  async testFullIntegration() {
    console.log(warning('\n🔄 Test 5: Full Integration Flow'));
    
    if (!this.token) {
      console.log(warning('⏭️  Skipping: No authentication token'));
      return;
    }

    try {
      // Create a conversation
      const convResponse = await axios.post(
        `${BACKEND_URL}/api/chat/conversations`,
        { title: 'Diagnostic Test' },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      const conversationId = convResponse.data.id;
      console.log(success('✅ Conversation created'));
      console.log(info(`   ID: ${conversationId}`));

      // Send a message via API
      const messageResponse = await axios.post(
        `${BACKEND_URL}/api/chat/messages`,
        {
          conversationId,
          message: 'Quel est mon solde de congés ?'
        },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      console.log(success('✅ Message sent via API'));
      console.log(info(`   Bot response: ${messageResponse.data.botMessage?.content?.substring(0, 50)}...`));

      // Get conversation history
      const historyResponse = await axios.get(
        `${BACKEND_URL}/api/chat/conversations/${conversationId}/messages`,
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      console.log(success('✅ Conversation history retrieved'));
      console.log(info(`   Messages count: ${historyResponse.data.length}`));

      this.results.integration.status = 'success';
      this.results.integration.details = {
        conversationCreated: true,
        messagesSent: true,
        historyRetrieved: true
      };

    } catch (err) {
      this.results.integration.status = 'failed';
      this.results.integration.details = { error: err.response?.data?.message || err.message };
      console.log(error('❌ Integration flow failed'));
      console.log(error(`   Error: ${err.response?.data?.message || err.message}`));
    }
  }

  // Print Summary
  printSummary() {
    console.log(warning('\n📊 DIAGNOSTIC SUMMARY\n'));
    
    const tests = [
      { name: 'Backend Health', result: this.results.backend },
      { name: 'Authentication', result: this.results.auth },
      { name: 'Socket.IO', result: this.results.socket },
      { name: 'API Endpoints', result: this.results.api },
      { name: 'Integration', result: this.results.integration }
    ];

    tests.forEach(test => {
      const statusIcon = test.result.status === 'success' ? '✅' : 
                        test.result.status === 'partial' ? '⚠️' : '❌';
      const statusColor = test.result.status === 'success' ? success : 
                         test.result.status === 'partial' ? warning : error;
      
      console.log(`${statusIcon} ${test.name}: ${statusColor(test.result.status.toUpperCase())}`);
    });

    // Overall status
    const allSuccess = tests.every(t => t.result.status === 'success');
    const anyFailed = tests.some(t => t.result.status === 'failed');

    console.log('\n' + '─'.repeat(50));
    if (allSuccess) {
      console.log(success('\n🎉 All tests passed! Your connection is working perfectly.'));
    } else if (anyFailed) {
      console.log(error('\n⚠️  Some tests failed. Check the details above for troubleshooting.'));
      this.printTroubleshooting();
    } else {
      console.log(warning('\n⚠️  Some issues detected. Connection is partially working.'));
    }
  }

  printTroubleshooting() {
    console.log(warning('\n🔧 TROUBLESHOOTING GUIDE\n'));

    if (this.results.backend.status === 'failed') {
      console.log(error('Backend not running:'));
      console.log('  1. cd chatbot-rh-backend');
      console.log('  2. npm install');
      console.log('  3. npm run dev');
      console.log('  4. Check that PostgreSQL and Redis are running');
    }

    if (this.results.auth.status === 'failed') {
      console.log(error('\nAuthentication failed:'));
      console.log('  1. Check JWT_SECRET in backend .env');
      console.log('  2. Verify database connection');
      console.log('  3. Run: npm run db:seed');
    }

    if (this.results.socket.status === 'failed') {
      console.log(error('\nSocket.IO failed:'));
      console.log('  1. Check CORS configuration');
      console.log('  2. Verify Socket.IO versions match');
      console.log('  3. Check firewall/proxy settings');
    }

    if (this.results.api.status === 'failed' || this.results.api.status === 'partial') {
      console.log(error('\nAPI endpoints failed:'));
      console.log('  1. Check route definitions');
      console.log('  2. Verify middleware order');
      console.log('  3. Check database migrations');
    }
  }
}

// Run diagnostic
const diagnostic = new ConnectionDiagnostic();
diagnostic.run().catch(console.error);