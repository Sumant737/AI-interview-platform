// src/pages/Dashboard.jsx - Complete Updated Version with Subscription Check
import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import useStore from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  LogOut, 
  User, 
  Plus, 
  Briefcase, 
  Building, 
  TrendingUp,
  FileText,
  Play,
  BarChart3,
  Sparkles,
  AlertCircle,
  Target,
  Crown,
  Star,
  Award,
  Zap
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    setCurrentUser, 
    canCreateTemplate,
    setTemplateState,
    templateState,
    stopCamera,
    subscription,
    getPlanLimits,
    setSubscription
  } = useStore();
  const [interviewTemplates, setInterviewTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadInterviewTemplates();
        checkSubscriptionStatus(); // Check subscription on load
      } else {
        setLoading(false);
        navigate('/login');
      }
    });

    stopCamera();
    return () => unsubscribe();
  }, [navigate, setCurrentUser]);

  // NEW: Check subscription status
  const checkSubscriptionStatus = async () => {
    if (!auth.currentUser) {
      setSubscriptionLoading(false);
      return;
    }
    
    try {
      console.log('🔍 Checking subscription status...');
      
      const checkStatus = httpsCallable(functions, 'checkSubscriptionStatus');
      const result = await checkStatus();
      
      console.log('✅ Subscription status:', result.data);
      
      // Update subscription in store
      setSubscription(result.data);
      
      // Update template limits based on subscription
      if (result.data.features) {
        setTemplateState({
          templateLimit: result.data.features.templateLimit,
          attemptLimit: result.data.features.attemptLimit
        });
        
        console.log('📊 Limits updated:', {
          templateLimit: result.data.features.templateLimit,
          attemptLimit: result.data.features.attemptLimit
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to check subscription:', error);
      toast.error('Could not load subscription status');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const loadInterviewTemplates = async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user');
      setLoading(false);
      return;
    }
    
    try {
      const q = query(
        collection(db, 'interviewTemplates'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const templates = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📁 Loaded templates:', templates.length);
      
      setInterviewTemplates(templates);
      setTemplateState({ userTemplates: templates });
    } catch (error) {
      console.error('Error loading interview templates:', error);
      if (error.code === 'permission-denied') {
        toast.error('Permission denied. Please check your login status.');
      } else if (error.code === 'failed-precondition') {
        toast.error('Database index required. Check Firebase console.');
      } else {
        toast.error('Failed to load your interviews');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      stopCamera();
      await signOut(auth);
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  const createNewInterview = () => {
    if (!canCreateTemplate()) {
      toast.error(`Maximum templates (${templateState.templateLimit}) reached. Upgrade your plan to create more.`);
      navigate('/pricing');
      return;
    }
    navigate('/create-interview');
  };

  const viewTemplate = (template) => {
    navigate(`/template/${template.id}`);
  };

  const viewResults = (template) => {
    if (template.lastSessionId) {
      navigate(`/results/${template.lastSessionId}`);
    } else {
      toast.error('No previous attempts found for this interview');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+': case 'A': return 'text-green-600 bg-green-100';
      case 'B+': case 'B': return 'text-blue-600 bg-blue-100';
      case 'C+': case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAttemptsColor = (attempts, limit) => {
    const percentage = attempts / limit;
    if (percentage >= 1) return 'text-red-600 bg-red-100';
    if (percentage >= 0.66) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  // Get plan icon based on subscription
  const getPlanIcon = () => {
    const icons = { 
      free: Star, 
      student: Award, 
      pro: Crown, 
      premium: Zap 
    };
    return icons[subscription.plan] || Star;
  };

  const limits = getPlanLimits();
  const PlanIcon = getPlanIcon();

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">AI Interview Platform</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{auth.currentUser?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Subscription Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <PlanIcon className="h-5 w-5 text-white" />
                <span className="text-white font-semibold capitalize">
                  {subscription.plan} Plan
                </span>
              </div>
              <div className="hidden md:flex items-center space-x-6 text-sm text-white/90">
                <span>
                  📁 {interviewTemplates.length}/
                  {limits.templateLimit === Infinity ? '∞' : limits.templateLimit} Templates
                </span>
                <span>
                  🎯 {limits.attemptLimit === Infinity ? '∞' : limits.attemptLimit} Attempts/Template
                </span>
                <span className="capitalize">
                  📊 {limits.modes.join(', ')} Modes
                </span>
              </div>
            </div>
            {subscription.plan !== 'premium' && (
              <button
                onClick={() => navigate('/pricing')}
                className="flex items-center space-x-2 px-6 py-2 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-100 transition-all shadow-lg"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Upgrade Plan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to Your Interview Dashboard
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Manage your interview practice sessions, track your progress, and improve your skills with AI-powered feedback.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Templates</p>
                  <p className="text-3xl font-bold text-gray-900">{interviewTemplates.length}</p>
                  <p className="text-xs text-gray-500">
                    Max: {templateState.templateLimit === Infinity ? '∞' : templateState.templateLimit}
                  </p>
                </div>
                <Briefcase className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Attempts</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {interviewTemplates.reduce((acc, t) => acc + (t.attemptCount || 0), 0)}
                  </p>
                </div>
                <Target className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Sessions</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {interviewTemplates.filter(t => t.attemptCount > 0).length}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {interviewTemplates.length > 0 
                      ? Math.round(interviewTemplates.reduce((acc, t) => acc + (t.lastScore || 0), 0) / interviewTemplates.length)
                      : 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Template Limit Warning */}
          {interviewTemplates.length >= limits.templateLimit && limits.templateLimit !== Infinity && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-amber-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Template Limit Reached</p>
                  <p className="text-sm text-amber-700">
                    You have reached the maximum of {limits.templateLimit} interview templates. 
                    <button 
                      onClick={() => navigate('/pricing')}
                      className="ml-1 underline font-semibold hover:text-amber-900"
                    >
                      Upgrade your plan
                    </button> to create more.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Create New Interview Button */}
          <div className="flex justify-center">
            <button
              onClick={createNewInterview}
              disabled={!canCreateTemplate()}
              className="flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5" />
              <span>Create New Interview Template</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">
                {interviewTemplates.length}/{templateState.templateLimit === Infinity ? '∞' : templateState.templateLimit}
              </span>
            </button>
          </div>

          {/* Interview Templates */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Your Interview Templates</h3>
            
            {interviewTemplates.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Templates Yet</h3>
                <p className="text-gray-600 mb-6">
                  Create your first interview template to start practicing with AI-powered feedback
                </p>
                <button
                  onClick={createNewInterview}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Your First Template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {interviewTemplates.map((template) => (
                  <div key={template.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-1">
                          {template.jobRole}
                        </h4>
                        {template.companyName && (
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <Building className="h-4 w-4 mr-1" />
                            <span>{template.companyName}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        {template.lastGrade && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGradeColor(template.lastGrade)}`}>
                            Grade: {template.lastGrade}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAttemptsColor(template.attemptCount || 0, templateState.attemptLimit)}`}>
                          {template.attemptCount || 0}/{templateState.attemptLimit === Infinity ? '∞' : templateState.attemptLimit} attempts
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Last Score:</span>
                        <span className="font-medium">{template.lastScore || 0}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">{formatDate(template.createdAt)}</span>
                      </div>
                      {template.lastAttemptAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Last Attempt:</span>
                          <span className="font-medium">{formatDate(template.lastAttemptAt)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => viewTemplate(template)}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Play className="h-4 w-4" />
                        <span>View</span>
                      </button>
                      
                      {template.attemptCount > 0 && (
                        <button
                          onClick={() => viewResults(template)}
                          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Results</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
