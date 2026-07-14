// src/pages/TemplateDetails.jsx - WITH RESUME DETECTION
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Play, 
  FileText, 
  Briefcase, 
  Building, 
  Calendar,
  Trophy,
  Target,
  Trash2,
  AlertCircle,
  Clock,
  BarChart3,
  Download,
  Eye,
  Zap,
  Users,
  CheckCircle,
  RefreshCw // NEW: For resume icon
} from 'lucide-react';


export default function TemplateDetails() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { 
    canAttemptTemplate, 
    templateState, 
    setApplicationData,
    hasActiveSession, // NEW: Check for active session
    interviewState // NEW: Get current interview state
  } = useStore();
  
  const [template, setTemplate] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResumePreview, setShowResumePreview] = useState(false);
  
  // Mode selector state
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState('standard');

  // NEW: Check if there's an active session for this template
  const hasIncompleteInterview = hasActiveSession() && interviewState.templateId === templateId;


  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    loadTemplateDetails();
  }, [templateId]);


  // Get question count based on mode
  const getQuestionCount = (mode) => {
    switch(mode) {
      case 'short': return { min: 3, max: 5, default: 4 };
      case 'standard': return { min: 6, max: 10, default: 8 };
      case 'comprehensive': return { min: 11, max: 15, default: 13 };
      default: return { min: 6, max: 10, default: 8 };
    }
  };


  const loadTemplateDetails = async () => {
    try {
      // Load template data
      const templateDoc = await getDoc(doc(db, 'interviewTemplates', templateId));
      if (!templateDoc.exists()) {
        toast.error('Template not found');
        navigate('/');
        return;
      }

      const templateData = templateDoc.data();
      if (templateData.userId !== auth.currentUser.uid) {
        toast.error('Unauthorized access to template');
        navigate('/');
        return;
      }

      setTemplate({ id: templateDoc.id, ...templateData });

      // Load recent attempts
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', auth.currentUser.uid),
        where('templateId', '==', templateId),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc')
      );

      const sessionsSnapshot = await getDocs(sessionsQuery);
      const attemptsData = sessionsSnapshot.docs.slice(0, 3).map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate?.() || doc.data().completedAt
      }));

      setAttempts(attemptsData);
    } catch (error) {
      console.error('Error loading template details:', error);
      toast.error('Failed to load template details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };


  // UPDATED: Handle start interview with resume detection
  const handleStartInterviewClick = () => {
    if (!canAttemptTemplate(templateId)) {
      toast.error(`Maximum attempts (${templateState.attemptLimit}) reached for this template`);
      return;
    }

    // NEW: Check for incomplete interview
    if (hasIncompleteInterview) {
      // Directly resume - don't show mode selector
      resumeIncompleteInterview();
    } else {
      // Show mode selector for new interview
      setShowModeSelector(true);
    }
  };


  // NEW: Resume incomplete interview
  const resumeIncompleteInterview = () => {
    const currentQuestion = interviewState.currentQuestion + 1;
    const totalQuestions = interviewState.questions.length;
    
    toast.success(`Resuming interview - Question ${currentQuestion} of ${totalQuestions}`);
    navigate(`/interview/${templateId}`);
  };


  // Start new interview with selected mode
  const startInterviewWithMode = () => {
    const questionCount = getQuestionCount(selectedMode).default;

    // Store template data in Zustand with selected mode
    setApplicationData({
      jobRole: template.jobRole,
      jobDescription: template.jobDescription,
      companyName: template.companyName || '',
      resumeContent: template.resumeFileName ? `Resume file: ${template.resumeFileName}` : null,
      templateId: templateId,
      interviewMode: selectedMode,
      questionCount: questionCount
    });

    toast.success(`Starting ${selectedMode} interview with ${questionCount} questions`);
    navigate(`/interview/${templateId}`);
  };


  const viewAttemptResults = (sessionId) => {
    navigate(`/results/${sessionId}`);
  };


  const deleteTemplate = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this template? This action cannot be undone and will remove all associated data.`
    );
    
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'interviewTemplates', templateId));
      toast.success('Template deleted successfully');
      navigate('/');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };


  const downloadResume = () => {
    if (template.resumeUrl) {
      const link = document.createElement('a');
      link.href = template.resumeUrl;
      link.download = template.resumeFileName || 'resume';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Resume download started');
    }
  };


  const viewResumeInNewTab = () => {
    if (template.resumeUrl) {
      window.open(template.resumeUrl, '_blank');
    }
  };


  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+': case 'A': return 'text-green-600 bg-green-100 border-green-300';
      case 'B+': case 'B': return 'text-blue-600 bg-blue-100 border-blue-300';
      case 'C+': case 'C': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'D': return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'F': return 'text-red-600 bg-red-100 border-red-300';
      default: return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };


  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading template details...</p>
        </div>
      </div>
    );
  }


  if (!template) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Not Found</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }


  const remainingAttempts = templateState.attemptLimit - (template.attemptCount || 0);
  const canStart = remainingAttempts > 0;


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="space-y-8">
          {/* NEW: Incomplete Interview Warning Banner */}
          {hasIncompleteInterview && (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-6 rounded-lg shadow-lg">
              <div className="flex items-start">
                <RefreshCw className="h-6 w-6 text-orange-400 mr-3 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-800 mb-2">
                    Resume Your Interview
                  </h3>
                  <p className="text-sm text-orange-700 mb-3">
                    You have an incomplete interview for this template. You're currently on question{' '}
                    <span className="font-semibold">{interviewState.currentQuestion + 1}</span> of{' '}
                    <span className="font-semibold">{interviewState.questions.length}</span>.
                  </p>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={resumeIncompleteInterview}
                      className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Resume Interview</span>
                    </button>
                    <span className="text-xs text-orange-600">
                      Progress will be lost if you start a new interview
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Template Header */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{template.jobRole}</h1>
                {template.companyName && (
                  <div className="flex items-center text-lg text-gray-600 mb-4">
                    <Building className="h-5 w-5 mr-2" />
                    <span>{template.companyName}</span>
                  </div>
                )}
              </div>
              <button
                onClick={deleteTemplate}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Template</span>
              </button>
            </div>

            {/* Template Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Target className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{template.attemptCount || 0}</div>
                <div className="text-sm text-gray-600">Total Attempts</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Trophy className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className={`text-2xl font-bold ${getScoreColor(template.lastScore || 0)}`}>
                  {template.lastScore || 0}%
                </div>
                <div className="text-sm text-gray-600">Best Score</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{template.lastGrade || 'N/A'}</div>
                <div className="text-sm text-gray-600">Latest Grade</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{remainingAttempts}</div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
            </div>

            {/* UPDATED: Start Button with conditional text */}
            <div className="text-center">
              {canStart ? (
                <button
                  onClick={handleStartInterviewClick}
                  className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
                >
                  {hasIncompleteInterview ? (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      <span>Resume Interview</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      <span>Start New Attempt</span>
                    </>
                  )}
                  <span className="text-xs bg-white/20 px-2 py-1 rounded">
                    {remainingAttempts} left
                  </span>
                </button>
              ) : (
                <div className="inline-flex items-center space-x-2 px-8 py-4 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed">
                  <AlertCircle className="h-5 w-5" />
                  <span>Maximum Attempts Reached</span>
                </div>
              )}
            </div>
          </div>

          {/* Template Information - SAME AS BEFORE */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Briefcase className="h-5 w-5 mr-2" />
              Template Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Role</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-800">{template.jobRole}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-800 whitespace-pre-wrap">
                  {template.jobDescription}
                </div>
              </div>
              {template.companyName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-800">{template.companyName}</div>
                </div>
              )}
              
              {/* Resume Display - SAME AS BEFORE */}
              {template.resumeUrl && template.resumeFileName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Resume</label>
                  <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">{template.resumeFileName}</p>
                          <p className="text-sm text-green-600">Resume uploaded successfully</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={viewResumeInNewTab}
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={downloadResume}
                          className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="border border-gray-300 rounded-lg bg-white">
                      <iframe
                        src={`${template.resumeUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-96 rounded-lg"
                        title="Resume Preview"
                        onError={() => {
                          console.log('Resume preview failed, showing download option only');
                        }}
                      />
                      <div className="p-3 bg-gray-50 border-t rounded-b-lg">
                        <p className="text-xs text-gray-600 text-center">
                          Resume preview - Click "View" to open in full screen or "Download" to save locally
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-800">
                  {formatDate(template.createdAt?.toDate?.() || template.createdAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Attempts - SAME AS BEFORE */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Recent Attempts (Last 3)
            </h3>
            
            {attempts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <Target className="h-16 w-16 mx-auto" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Attempts Yet</h4>
                <p className="text-gray-600">Start your first interview attempt to see results here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attempts.map((attempt, index) => (
                  <div key={attempt.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-600">Attempt #{attempts.length - index}</span>
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{formatDate(attempt.completedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {attempt.finalReport && (
                          <>
                            <span className={`text-lg font-semibold ${getScoreColor(attempt.finalReport.overallScore || 0)}`}>
                              {attempt.finalReport.overallScore || 0}%
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getGradeColor(attempt.finalReport.grade)}`}>
                              {attempt.finalReport.grade}
                            </span>
                          </>
                        )}
                        <button
                          onClick={() => viewAttemptResults(attempt.id)}
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          <FileText className="h-4 w-4" />
                          <span>View Report</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attempt Limit Warning */}
          {!canStart && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Maximum Attempts Reached
                  </p>
                  <p className="text-sm text-red-700">
                    You have completed all {templateState.attemptLimit} attempts for this template. 
                    Create a new template if you want to practice with different job requirements.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mode Selector Modal - ONLY shown for NEW interviews */}
      {showModeSelector && !hasIncompleteInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Interview Length</h2>
            <p className="text-gray-600 mb-6">Select how many questions you'd like to practice with</p>

            {/* Mode Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Short Mode */}
              <button
                onClick={() => setSelectedMode('short')}
                className={`relative p-6 border-2 rounded-xl transition-all ${
                  selectedMode === 'short'
                    ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                    : 'border-gray-300 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <Zap className={`h-12 w-12 mb-3 ${selectedMode === 'short' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <h4 className="font-bold text-lg text-gray-900 mb-1">Short</h4>
                  <p className="text-2xl font-bold text-blue-600 mb-2">3-5</p>
                  <p className="text-sm text-gray-600 mb-1">Questions</p>
                  <p className="text-xs text-gray-500">~15-20 mins</p>
                  <p className="text-xs text-gray-500 mt-2">Quick warmup</p>
                </div>
                {selectedMode === 'short' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                )}
              </button>

              {/* Standard Mode */}
              <button
                onClick={() => setSelectedMode('standard')}
                className={`relative p-6 border-2 rounded-xl transition-all ${
                  selectedMode === 'standard'
                    ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                    : 'border-gray-300 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <Users className={`h-12 w-12 mb-3 ${selectedMode === 'standard' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <h4 className="font-bold text-lg text-gray-900 mb-1">Standard</h4>
                  <p className="text-2xl font-bold text-blue-600 mb-2">6-10</p>
                  <p className="text-sm text-gray-600 mb-1">Questions</p>
                  <p className="text-xs text-gray-500">~30-40 mins</p>
                  <p className="text-xs text-gray-500 mt-2">Recommended</p>
                </div>
                {selectedMode === 'standard' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                )}
              </button>

              {/* Comprehensive Mode */}
              <button
                onClick={() => setSelectedMode('comprehensive')}
                className={`relative p-6 border-2 rounded-xl transition-all ${
                  selectedMode === 'comprehensive'
                    ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                    : 'border-gray-300 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <Target className={`h-12 w-12 mb-3 ${selectedMode === 'comprehensive' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <h4 className="font-bold text-lg text-gray-900 mb-1">Comprehensive</h4>
                  <p className="text-2xl font-bold text-blue-600 mb-2">11-15</p>
                  <p className="text-sm text-gray-600 mb-1">Questions</p>
                  <p className="text-xs text-gray-500">~50-60 mins</p>
                  <p className="text-xs text-gray-500 mt-2">Full practice</p>
                </div>
                {selectedMode === 'comprehensive' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                )}
              </button>
            </div>

            {/* Selected Mode Info */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg mb-6">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">
                  {selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)} Mode
                </span>
                {' '}selected - You'll answer {getQuestionCount(selectedMode).default} AI-generated questions
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={() => setShowModeSelector(false)}
                className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startInterviewWithMode}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Play className="h-5 w-5" />
                <span>Start Interview</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
