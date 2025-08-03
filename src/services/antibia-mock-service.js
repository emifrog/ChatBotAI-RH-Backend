// Service de simulation Antibia avec données réalistes pour la démo

class AntibiaMockService {
    constructor() {
      // Données de démonstration réalistes
      this.mockData = {
        employees: [
          {
            id: 'emp-001',
            email: 'marie.dupont@entreprise.fr',
            firstName: 'Marie',
            lastName: 'Dupont',
            department: 'Marketing',
            position: 'Chef de projet',
            manager: 'Pierre Martin',
            startDate: '2021-03-15',
            contractType: 'CDI',
            photo: '/avatars/marie.jpg'
          },
          {
            id: 'emp-002',
            email: 'paul.martin@entreprise.fr',
            firstName: 'Paul',
            lastName: 'Martin',
            department: 'Informatique',
            position: 'Développeur Senior',
            manager: 'Sophie Bernard',
            startDate: '2019-09-01',
            contractType: 'CDI',
            photo: '/avatars/paul.jpg'
          }
        ],
        
        leaveBalances: {
          'emp-001': {
            userId: 'emp-001',
            year: 2025,
            balances: [
              {
                type: 'CP',
                label: 'Congés Payés',
                acquired: 25,
                taken: 10,
                pending: 2,
                remaining: 13,
                unit: 'jours'
              },
              {
                type: 'RTT',
                label: 'RTT',
                acquired: 12,
                taken: 5,
                pending: 0,
                remaining: 7,
                unit: 'jours'
              }
            ],
            nextAcquisition: {
              date: '2025-09-01',
              amount: 2.08,
              type: 'CP'
            }
          }
        },
        
        leaveRequests: [
          {
            id: 'req-001',
            userId: 'emp-001',
            type: 'CP',
            startDate: '2025-08-15',
            endDate: '2025-08-29',
            duration: 10,
            status: 'approved',
            reason: 'Vacances été',
            approvedBy: 'Pierre Martin',
            approvedAt: '2025-07-20',
            createdAt: '2025-07-15'
          },
          {
            id: 'req-002',
            userId: 'emp-001',
            type: 'RTT',
            startDate: '2025-09-05',
            endDate: '2025-09-05',
            duration: 1,
            status: 'pending',
            reason: 'Rendez-vous personnel',
            createdAt: '2025-08-01'
          }
        ],
        
        payslips: {
          'emp-001': [
            {
              id: 'pay-202507',
              userId: 'emp-001',
              period: 'Juillet 2025',
              issueDate: '2025-07-31',
              netSalary: 2850.45,
              grossSalary: 3750.00,
              fileUrl: '/payslips/marie-202507.pdf',
              details: {
                baseSalary: 3500.00,
                bonus: 250.00,
                deductions: 899.55
              }
            },
            {
              id: 'pay-202506',
              userId: 'emp-001',
              period: 'Juin 2025',
              issueDate: '2025-06-30',
              netSalary: 2850.45,
              grossSalary: 3750.00,
              fileUrl: '/payslips/marie-202506.pdf'
            }
          ]
        },
        
        trainings: [
          {
            id: 'train-001',
            title: 'Management Agile',
            description: 'Formation aux méthodes agiles pour managers',
            duration: '2 jours',
            format: 'Présentiel',
            startDate: '2025-09-15',
            location: 'Paris',
            price: 1200,
            available: true,
            category: 'Management',
            provider: 'AgileCorp',
            maxParticipants: 12,
            enrolled: 8
          },
          {
            id: 'train-002',
            title: 'Excel Avancé',
            description: 'Maîtrisez les fonctions avancées d\'Excel',
            duration: '1 jour',
            format: 'Distanciel',
            startDate: '2025-09-20',
            price: 450,
            available: true,
            category: 'Bureautique',
            provider: 'FormaPro',
            maxParticipants: 20,
            enrolled: 15
          }
        ],
        
        userTrainings: {
          'emp-001': [
            {
              trainingId: 'train-003',
              title: 'RGPD et Protection des données',
              status: 'completed',
              completedDate: '2025-06-15',
              score: 85,
              certificate: true
            }
          ]
        }
      };
    }
  
    // Authentification
    async authenticate(email, password) {
      const employee = this.mockData.employees.find(e => e.email === email);
      if (employee && password === 'demo123') {
        return {
          success: true,
          token: 'mock-jwt-token',
          user: employee
        };
      }
      throw new Error('Invalid credentials');
    }
  
    // Profil utilisateur
    async getUserProfile(userId) {
      const employee = this.mockData.employees.find(e => e.id === userId);
      if (!employee) throw new Error('User not found');
      return employee;
    }
  
    // Congés
    async getLeaveBalance(userId) {
      return this.mockData.leaveBalances[userId] || {
        userId,
        year: 2025,
        balances: []
      };
    }
  
    async getLeaveRequests(userId) {
      return this.mockData.leaveRequests.filter(r => r.userId === userId);
    }
  
    async createLeaveRequest(userId, request) {
      const newRequest = {
        id: `req-${Date.now()}`,
        userId,
        ...request,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      this.mockData.leaveRequests.push(newRequest);
      
      // Simuler une notification
      setTimeout(() => {
        newRequest.status = 'approved';
        newRequest.approvedBy = 'Manager';
        newRequest.approvedAt = new Date().toISOString();
      }, 5000);
      
      return newRequest;
    }
  
    // Paie
    async getPayslips(userId) {
      return this.mockData.payslips[userId] || [];
    }
  
    async getPayslipFile(payslipId) {
      // Simuler un fichier PDF
      return {
        filename: `bulletin-${payslipId}.pdf`,
        contentType: 'application/pdf',
        data: 'mock-pdf-data'
      };
    }
  
    // Formations
    async getTrainingCatalog(filters = {}) {
      let trainings = [...this.mockData.trainings];
      
      if (filters.category) {
        trainings = trainings.filter(t => t.category === filters.category);
      }
      
      if (filters.format) {
        trainings = trainings.filter(t => t.format === filters.format);
      }
      
      return trainings;
    }
  
    async getUserTrainings(userId) {
      return this.mockData.userTrainings[userId] || [];
    }
  
    async enrollTraining(userId, trainingId) {
      const training = this.mockData.trainings.find(t => t.id === trainingId);
      if (!training) throw new Error('Training not found');
      
      if (!training.available) throw new Error('Training not available');
      
      const enrollment = {
        userId,
        trainingId,
        enrolledAt: new Date().toISOString(),
        status: 'enrolled'
      };
      
      return {
        success: true,
        message: 'Inscription confirmée',
        enrollment
      };
    }
  
    // Documents
    async generateDocument(userId, type) {
      const employee = await this.getUserProfile(userId);
      
      const documents = {
        'attestation-employeur': {
          title: 'Attestation Employeur',
          content: `Nous certifions que ${employee.firstName} ${employee.lastName} est employé(e) dans notre entreprise depuis le ${employee.startDate} en qualité de ${employee.position}.`,
          filename: 'attestation-employeur.pdf'
        },
        'certificat-travail': {
          title: 'Certificat de Travail',
          content: `Certificat de travail pour ${employee.firstName} ${employee.lastName}...`,
          filename: 'certificat-travail.pdf'
        }
      };
      
      return documents[type] || null;
    }
  
    // Analytics pour le dashboard
    async getHRAnalytics() {
      return {
        totalEmployees: 250,
        activeLeaveRequests: 12,
        pendingTrainings: 34,
        averageResponseTime: '2.5 heures',
        satisfactionRate: 87,
        topQuestions: [
          { question: 'Solde de congés', count: 145 },
          { question: 'Bulletins de paie', count: 98 },
          { question: 'Formations disponibles', count: 76 }
        ]
      };
    }
  }
  
  module.exports = new AntibiaMockService();