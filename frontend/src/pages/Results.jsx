// src/pages/Results.jsx - UPDATED WITH EMOTION ANALYSIS (NO CHARTS)
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import useStore from '../store/useStore';
import { 
  ArrowLeft, Download, Trophy, TrendingUp, BookOpen, MessageSquare, 
  CheckCircle, AlertCircle, Plus, RefreshCw, BarChart3, Mic, Edit3,
  Clock, Volume2, Target, Award, Smile, Heart // NEW: Emotion icons
} from 'lucide-react';
import toast from 'react-hot-toast';


// NEW: Emotion emoji mapping
const EMOTION_EMOJIS = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  surprised: '😮',
  fearful: '😰',
  neutral: '😐',
  disgusted: '🤢'
};


export default function Results() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { interviewState, canAttemptTemplate, templateState, refreshTemplateData} = useStore();
  const [report, setReport] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluationStatus, setEvaluationStatus] = useState({ pending: 0, total: 0 });


  useEffect(() => {
  let mounted = true;

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      init();
    } else {
      navigate('/login');
    }
  });

  const init = async () => {
    console.log('Results component mounted with sessionId:', sessionId);
    console.log('Interview state final report:', interviewState.finalReport);
    
    try {
      if (interviewState.finalReport && interviewState.sessionId === sessionId) {
        console.log('Using final report from interview state');
        setReport(interviewState.finalReport);
        await loadAnswersAndQuestions();
      } else {
        console.log('Loading report from Firestore');
        await loadReport();
      }

      // ✅ NEW: Refresh template data after report is loaded
      if (mounted && sessionData?.templateId) {
        console.log('Refreshing template data for:', sessionData.templateId);
        await refreshTemplateData(sessionData.templateId);
      }

    } catch (error) {
      console.error('Error in init:', error);
      toast.error('Failed to load interview results');
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  return () => {
    mounted = false;
    unsubscribe();
  };
}, [sessionId, navigate]);

// ✅ NEW: Separate useEffect to refresh template when report loads
useEffect(() => {
  if (report && sessionData?.templateId) {
    console.log('Report loaded - refreshing template data for:', sessionData.templateId);
    refreshTemplateData(sessionData.templateId).then(freshData => {
      if (freshData) {
        console.log('✅ Template refreshed - New attempt count:', freshData.attemptCount);
        toast.success(`Template updated: ${freshData.attemptCount}/${templateState.attemptLimit} attempts used`, {
          id: 'template-refresh',
          duration: 2000
        });
      }
    });
  }
}, [report, sessionData?.templateId]);



  const loadAnswersAndQuestions = async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user');
      return;
    }

    try {
      console.log('Loading individual answers for session:', sessionId);
      
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
      if (!sessionDoc.exists()) {
        toast.error('Session not found');
        navigate('/');
        return;
      }

      const sessionData = sessionDoc.data();
      
      if (sessionData.userId !== auth.currentUser.uid) {
        toast.error('Unauthorized access to session');
        navigate('/');
        return;
      }

      setSessionData(sessionData);
      setQuestions(sessionData.questions || []);

      const answersQuery = query(
        collection(db, 'sessions', sessionId, 'answers'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'asc')
      );

      const answersSnapshot = await getDocs(answersQuery);
      const answersData = answersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => parseInt(a.questionId) - parseInt(b.questionId));

      console.log('Loaded answers with communication analysis:', answersData);
      setAnswers(answersData);
    } catch (error) {
      console.error('Error loading answers:', error);
      if (error.code === 'permission-denied') {
        toast.error('Permission denied. Please check your login status.');
      } else if (error.code === 'failed-precondition') {
        toast.error('Database index required. Check Firebase console.');
      } else {
        toast.error('Failed to load question details');
      }
    }
  };


  const loadReport = async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user');
      navigate('/login');
      return;
    }

    try {
      console.log('Fetching session document from Firestore:', sessionId);
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
      
      if (!sessionDoc.exists()) {
        console.log('Session document not found');
        toast.error('Interview session not found');
        navigate('/');
        return;
      }

      const data = sessionDoc.data();
      
      if (data.userId !== auth.currentUser.uid) {
        toast.error('Unauthorized access to session');
        navigate('/');
        return;
      }

      console.log('Session data retrieved:', data);
      
      setSessionData(data);
      setQuestions(data.questions || []);
      
      if (data.finalReport) {
        console.log('Final report found in Firestore:', data.finalReport);
        setReport(data.finalReport);
        await loadAnswersAndQuestions();
      } else {
        console.log('No final report found - checking evaluation status...');
        
        const answersSnapshot = await getDocs(
          query(
            collection(db, 'sessions', sessionId, 'answers'),
            where('userId', '==', auth.currentUser.uid)
          )
        );
        
        const allAnswers = answersSnapshot.docs.map(doc => doc.data());
        const totalAnswers = allAnswers.length;
        const pendingEvaluations = allAnswers.filter(answer => 
          !answer.evaluationStatus || 
          answer.evaluationStatus === 'pending' || 
          answer.evaluationStatus === 'evaluating'
        );
        
        const pendingCount = pendingEvaluations.length;
        const completedCount = totalAnswers - pendingCount;
        
        setEvaluationStatus({
          pending: pendingCount,
          total: totalAnswers,
          completed: completedCount
        });

        if (pendingCount > 0) {
          console.log(`${pendingCount}/${totalAnswers} evaluations still pending...`);
          toast.loading(
            `Evaluating answers: ${completedCount}/${totalAnswers} complete...`, 
            { 
              duration: 3000,
              icon: '⏳'
            }
          );
        } else if (totalAnswers > 0) {
          console.log('All evaluations complete, waiting for report generation...');
          toast.loading('Generating comprehensive report...', { duration: 3000, icon: '📊' });
        } else {
          toast.error('No answers found for this session');
          navigate('/');
          return;
        }
        
        setTimeout(() => {
          loadReport().then(() => setLoading(false));
        }, 3000);
        return;
      }
    } catch (error) {
      console.error('Error loading report:', error);
      if (error.code === 'permission-denied') {
        toast.error('Permission denied. Please check your login status.');
      } else {
        toast.error('Failed to load report');
      }
    }
  };


  const retryInterview = () => {
    if (!sessionData?.templateId) {
      toast.error('Template information not found. Please create a new interview.');
      navigate('/create-interview');
      return;
    }

    if (!canAttemptTemplate(sessionData.templateId)) {
      toast.error(`Maximum attempts (${templateState.attemptLimit}) reached for this template`);
      return;
    }

    navigate(`/template/${sessionData.templateId}`);
  };


  const getCommunicationGrade = (score) => {
    if (score >= 9) return { grade: 'A+', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 8) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 7) return { grade: 'B+', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 6) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 5) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { grade: 'D', color: 'text-red-600', bg: 'bg-red-100' };
  };


  // NEW: Get emotion rating color
  const getEmotionRatingColor = (rating) => {
    if (rating === 'Excellent') return 'text-green-600 bg-green-100';
    if (rating === 'Good') return 'text-blue-600 bg-blue-100';
    return 'text-orange-600 bg-orange-100';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your comprehensive interview results...</p>
          <p className="text-sm text-gray-500 mt-2">Analyzing communication patterns and emotional intelligence...</p>
          
          {evaluationStatus.total > 0 && (
            <div className="mt-4 p-4 bg-white rounded-lg shadow-md max-w-md mx-auto">
              <p className="text-sm font-semibold text-gray-700 mb-2">Evaluation Progress</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${((evaluationStatus.completed || 0) / evaluationStatus.total) * 100}%` 
                  }}
                />
              </div>
              <p className="text-xs text-gray-600">
                {evaluationStatus.completed || 0} of {evaluationStatus.total} answers evaluated
              </p>
              {evaluationStatus.pending > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  ⏳ {evaluationStatus.pending} evaluations in progress...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }


  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Report Generation in Progress</h2>
          <p className="text-gray-600 mb-6">
            Your interview report is being generated. 
            {evaluationStatus.total > 0 && (
              <span className="block mt-2 text-sm">
                {evaluationStatus.pending > 0 
                  ? `Waiting for ${evaluationStatus.pending} answer evaluations to complete...`
                  : 'All evaluations complete! Generating final report...'}
              </span>
            )}
          </p>
          
          {evaluationStatus.total > 0 && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div 
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${((evaluationStatus.completed || 0) / evaluationStatus.total) * 100}%` 
                  }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {evaluationStatus.completed || 0}/{evaluationStatus.total} evaluations complete
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={() => {
                setLoading(true);
                loadReport().then(() => setLoading(false));
              }}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Check Status</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-4">
            💡 Tip: You can close this page and come back later. Results will be saved.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </header>

      {/* Results Content */}
      <main className="max-w-6xl mx-auto py-8 px-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Comprehensive Interview Analysis</h1>
            <p className="text-gray-600">AI-powered evaluation with communication & emotional intelligence insights</p>
            {sessionData?.templateId && (
              <p className="text-sm text-blue-600 mt-2">
                Template: {sessionData.jobRole} {sessionData.companyName && `at ${sessionData.companyName}`}
              </p>
            )}
          </div>

          {/* Score Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Overall Score */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">{report.overallScore}%</div>
              <div className="text-xl font-semibold text-gray-800 mb-2">Overall Grade: {report.grade}</div>
              <p className="text-sm text-gray-600">Content & Technical Skills</p>
            </div>

            {/* Communication Score */}
            {report.communicationScores && (
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {report.communicationScores.overall || 0}/10
                </div>
                <div className="text-xl font-semibold text-gray-800 mb-2">
                  Communication: {getCommunicationGrade(report.communicationScores.overall || 0).grade}
                </div>
                <p className="text-sm text-gray-600">Speech & Delivery Analysis</p>
              </div>
            )}

            {/* Combined Rating */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {Math.round(((report.overallScore + (report.communicationScores?.overall || 0) * 10) / 2))}%
              </div>
              <div className="text-xl font-semibold text-gray-800 mb-2">Combined Score</div>
              <p className="text-sm text-gray-600">Overall Performance Rating</p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Performance Summary</h3>
            <p className="text-gray-700 text-lg leading-relaxed">{report.summary}</p>
          </div>

          {/* ========== NEW: EMOTIONAL INTELLIGENCE ANALYSIS ========== */}
          {report.emotionAnalysis && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <Smile className="h-6 w-6 mr-3 text-purple-600" />
                Emotional Intelligence Analysis
              </h3>

              {/* Emotional Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {report.emotionAnalysis.emotionalStability}/100
                  </div>
                  <div className="text-sm text-gray-600">Emotional Stability</div>
                  <div className="text-xs text-gray-500 mt-1">Consistency</div>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {report.emotionAnalysis.professionalComposure}/100
                  </div>
                  <div className="text-sm text-gray-600">Professional Composure</div>
                  <div className="text-xs text-gray-500 mt-1">Control</div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {report.emotionAnalysis.confidenceLevel}/100
                  </div>
                  <div className="text-sm text-gray-600">Confidence Level</div>
                  <div className="text-xs text-gray-500 mt-1">Self-assurance</div>
                </div>

                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className={`text-xl font-bold mb-1 ${
                    report.emotionAnalysis.stressLevel === 'low' ? 'text-green-600' :
                    report.emotionAnalysis.stressLevel === 'medium' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {report.emotionAnalysis.stressLevel === 'low' ? '🟢' :
                     report.emotionAnalysis.stressLevel === 'medium' ? '🟡' : '🔴'}
                    {' '}{report.emotionAnalysis.stressLevel.charAt(0).toUpperCase() + report.emotionAnalysis.stressLevel.slice(1)}
                  </div>
                  <div className="text-sm text-gray-600">Stress Level</div>
                  <div className="text-xs text-gray-500 mt-1">Overall</div>
                </div>
              </div>

              {/* Emotion Distribution */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Emotion Distribution</h4>
                <div className="space-y-2">
                  {Object.entries(report.emotionAnalysis.distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([emotion, percentage]) => (
                      <div key={emotion} className="flex items-center">
                        <div className="w-24 text-sm font-medium text-gray-700 flex items-center">
                          <span className="text-xl mr-2">{EMOTION_EMOJIS[emotion] || '😐'}</span>
                          <span className="capitalize">{emotion}:</span>
                        </div>
                        <div className="flex-1 mx-3">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${
                                emotion === 'neutral' ? 'bg-gray-500' :
                                emotion === 'happy' ? 'bg-green-500' :
                                emotion === 'fearful' ? 'bg-orange-500' :
                                emotion === 'surprised' ? 'bg-yellow-500' :
                                emotion === 'sad' ? 'bg-blue-500' :
                                emotion === 'angry' ? 'bg-red-500' : 'bg-purple-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-12 text-right text-sm font-semibold text-gray-700">
                          {percentage}%
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Emotional Intelligence Insights */}
              {report.emotionalIntelligence && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Overall Rating */}
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-md font-semibold text-gray-800">Overall Rating</h5>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getEmotionRatingColor(report.emotionalIntelligence.overallRating)}`}>
                        {report.emotionalIntelligence.overallRating}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{report.emotionalIntelligence.interpretation}</p>
                  </div>

                  {/* Comparison to Ideal */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h5 className="text-md font-semibold text-gray-800 mb-3">Comparison to Ideal Profile</h5>
                    <p className="text-sm text-gray-700">{report.emotionalIntelligence.comparison}</p>
                  </div>

                  {/* Strengths */}
                  {report.emotionalIntelligence.strengths && report.emotionalIntelligence.strengths.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h5 className="text-md font-semibold text-green-800 mb-2">Emotional Strengths</h5>
                      <ul className="space-y-1">
                        {report.emotionalIntelligence.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start text-sm text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvements */}
                  {report.emotionalIntelligence.improvements && report.emotionalIntelligence.improvements.length > 0 && (
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h5 className="text-md font-semibold text-orange-800 mb-2">Areas to Develop</h5>
                      <ul className="space-y-1">
                        {report.emotionalIntelligence.improvements.map((improvement, idx) => (
                          <li key={idx} className="flex items-start text-sm text-orange-700">
                            <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Communication Analysis Dashboard */}
          {report.communicationScores && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <BarChart3 className="h-6 w-6 mr-3 text-blue-600" />
                Communication Analysis Dashboard
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {Object.entries(report.communicationScores).map(([key, value]) => {
                  const gradeInfo = getCommunicationGrade(value);
                  return (
                    <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className={`text-2xl font-bold ${gradeInfo.color} mb-1`}>
                        {value}/10
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${gradeInfo.bg} ${gradeInfo.color} mb-2`}>
                        {gradeInfo.grade}
                      </div>
                      <div className="text-sm text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Communication Analysis Details */}
              {report.communicationAnalysis && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="text-lg font-semibold text-green-800 mb-3">Communication Strengths</h4>
                    <ul className="space-y-2">
                      {report.communicationAnalysis.keyStrengths?.map((strength, index) => (
                        <li key={index} className="flex items-start space-x-2 text-green-700">
                          <CheckCircle className="h-4 w-4 mt-1 flex-shrink-0" />
                          <span className="text-sm">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="text-lg font-semibold text-orange-800 mb-3">Areas for Improvement</h4>
                    <ul className="space-y-2">
                      {report.communicationAnalysis.areasForImprovement?.map((improvement, index) => (
                        <li key={index} className="flex items-start space-x-2 text-orange-700">
                          <AlertCircle className="h-4 w-4 mt-1 flex-shrink-0" />
                          <span className="text-sm">{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Question Analysis */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
              <MessageSquare className="h-6 w-6 mr-3 text-blue-600" />
              Detailed Question-by-Question Analysis
            </h3>
            
            <div className="space-y-8">
              {(report.detailedQuestionAnalysis || answers).map((item, index) => {
                const answer = report.detailedQuestionAnalysis ? item : item;
                const question = report.detailedQuestionAnalysis 
                  ? { question: item.question }
                  : questions.find(q => q.id === parseInt(item.questionId));
                const evaluation = report.detailedQuestionAnalysis 
                  ? { score: item.score, feedback: item.feedback }
                  : item.evaluation;
                
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-6">
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">
                          Question {index + 1}:
                        </h4>
                        <p className="text-gray-700 italic mb-4">
                          {question?.question || item.question || 'Question not available'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          {evaluation?.score || item.score || 0}/20
                        </div>
                        {item.communicationMetrics && (
                          <div className="text-sm text-gray-600 mt-1">
                            Communication: {item.communicationMetrics.confidence || 0}/10
                          </div>
                        )}
                        {/* NEW: Show emotion for this question */}
                        {item.emotionalState && (
                          <div className="mt-2 px-2 py-1 bg-purple-100 rounded-full text-xs">
                            <span className="text-lg">{EMOTION_EMOJIS[item.emotionalState] || '😐'}</span>
                            <span className="ml-1 text-purple-700 capitalize">{item.emotionalState}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Answers Section */}
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      {/* Verbal Answer */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <Mic className="h-4 w-4 text-blue-600" />
                          <h5 className="font-semibold text-gray-700">Verbal Response</h5>
                        </div>
                        
                        {answer.browserTranscription && answer.googleTranscription && (
                          <div className="text-xs text-gray-500 mb-2">
                            <span className="bg-blue-100 px-2 py-1 rounded">Browser STT</span>
                            <span className="ml-2 bg-green-100 px-2 py-1 rounded">Google STT (Used for Analysis)</span>
                          </div>
                        )}
                        
                        <div className="p-3 bg-blue-50 rounded-md">
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">
                            {answer.verbalAnswer || answer.googleTranscription || answer.answer || 'No verbal response provided'}
                          </p>
                        </div>

                        {/* Speech Analysis Metrics */}
                        {(answer.speechAnalysisData || item.communicationMetrics) && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <div className="bg-gray-100 p-2 rounded text-xs">
                              <div className="font-medium">WPM</div>
                              <div className="text-blue-600">
                                {answer.speechAnalysisData?.wordsPerMinute || item.communicationMetrics?.wpm || 0}
                              </div>
                            </div>
                            <div className="bg-gray-100 p-2 rounded text-xs">
                              <div className="font-medium">Filler Words</div>
                              <div className="text-orange-600">
                                {answer.speechAnalysisData?.fillerWordCount || item.communicationMetrics?.fillerWords || 0}
                              </div>
                            </div>
                            <div className="bg-gray-100 p-2 rounded text-xs">
                              <div className="font-medium">Clarity</div>
                              <div className="text-green-600">
                                {answer.speechAnalysisData?.clarity || item.communicationMetrics?.clarity || 'N/A'}
                              </div>
                            </div>
                            <div className="bg-gray-100 p-2 rounded text-xs">
                              <div className="font-medium">Duration</div>
                              <div className="text-purple-600">
                                {answer.recordingDuration || 0}s
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Written Answer */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <Edit3 className="h-4 w-4 text-purple-600" />
                          <h5 className="font-semibold text-gray-700">Written Response</h5>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-md min-h-[80px]">
                          {answer.writtenAnswer || item.writtenAnswer ? (
                            <p className="text-gray-700 text-sm whitespace-pre-wrap font-mono">
                              {answer.writtenAnswer || item.writtenAnswer}
                            </p>
                          ) : (
                            <p className="text-gray-500 italic text-sm">No written response provided</p>
                          )}
                        </div>
                        {(answer.writtenAnswer || item.writtenAnswer) && (
                          <div className="text-xs text-gray-500">
                            {(answer.writtenAnswer || item.writtenAnswer || '').length} characters
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Feedback */}
                    {evaluation?.feedback && (
                      <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md">
                        <h5 className="text-md font-semibold text-blue-800 mb-2">AI Comprehensive Feedback:</h5>
                        <p className="text-blue-700 text-sm">{evaluation.feedback}</p>
                      </div>
                    )}

                    {/* Strengths and Improvements */}
                    {evaluation && (evaluation.strengths?.length > 0 || evaluation.improvements?.length > 0) && (
                      <div className="grid md:grid-cols-2 gap-4">
                        {evaluation.strengths?.length > 0 && (
                          <div className="p-3 bg-green-50 rounded-md">
                            <h6 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Strengths:
                            </h6>
                            <ul className="text-sm text-green-700 space-y-1">
                              {evaluation.strengths.map((strength, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-green-500 mr-1">•</span>
                                  <span>{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {evaluation.improvements?.length > 0 && (
                          <div className="p-3 bg-orange-50 rounded-md">
                            <h6 className="text-sm font-semibold text-orange-800 mb-2 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Areas for Improvement:
                            </h6>
                            <ul className="text-sm text-orange-700 space-y-1">
                              {evaluation.improvements.map((improvement, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-orange-500 mr-1">•</span>
                                  <span>{improvement}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Communication Score Breakdown */}
                    {evaluation?.communicationScore && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-md">
                        <h6 className="text-sm font-semibold text-gray-800 mb-2">Communication Breakdown:</h6>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {Object.entries(evaluation.communicationScore).map(([key, value]) => (
                            <div key={key} className="text-center">
                              <div className="font-medium text-gray-600 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </div>
                              <div className="text-blue-600 font-bold">{value}/10</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-green-600 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Top Strengths
              </h3>
              <ul className="space-y-3">
                {report.topStrengths?.map((strength, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-orange-600 mb-4 flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Key Improvements
              </h3>
              <ul className="space-y-3">
                {report.keyImprovements?.map((improvement, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-orange-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Additional Report Sections */}
          {report.industryReadiness && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="h-5 w-5 mr-2 text-purple-600" />
                Industry Readiness Assessment
              </h3>
              <p className="text-gray-700 leading-relaxed">{report.industryReadiness}</p>
            </div>
          )}

          {report.careerGuidance && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Career Guidance</h3>
              <p className="text-gray-700 leading-relaxed">{report.careerGuidance}</p>
            </div>
          )}

          {/* Study Plan */}
          {report.studyPlan && report.studyPlan.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                Personalized Study Plan
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {report.studyPlan.map((item, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <span className="bg-blue-600 text-white text-sm font-bold rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
            
            {sessionData?.templateId ? (
              <button
                onClick={retryInterview}
                disabled={!canAttemptTemplate(sessionData.templateId)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="h-4 w-4" />
                <span>
                  {canAttemptTemplate(sessionData.templateId) 
                    ? 'Retry This Template' 
                    : 'Max Attempts Reached'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/create-interview')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Template</span>
              </button>
            )}
            
            <button
              onClick={() => navigate('/create-interview')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Interview</span>
            </button>
            
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
