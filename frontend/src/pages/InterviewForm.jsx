// src/pages/InterviewForm.jsx - REMOVE MODE SELECTION
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';
import { ArrowLeft, Briefcase, FileText, Building, ArrowRight, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';


export default function InterviewForm() {
  const navigate = useNavigate();
  const { setApplicationData, setCurrentUser, canCreateTemplate, templateState } = useStore();
  const [formData, setFormData] = useState({
    jobRole: '',
    jobDescription: '',
    resumeFile: null,
    companyName: '',
    resumeUrl: null,
    resumeFileName: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userTemplateCount, setUserTemplateCount] = useState(0);
  const [uploadingResume, setUploadingResume] = useState(false);
  // REMOVED: interviewMode state


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        checkTemplateCount();
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate, setCurrentUser]);


  const checkTemplateCount = async () => {
    if (!auth.currentUser) return;

    try {
      const q = query(
        collection(db, 'interviewTemplates'),
        where('userId', '==', auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      setUserTemplateCount(querySnapshot.size);
    } catch (error) {
      console.error('Error checking template count:', error);
    }
  };


  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, DOC, or DOCX file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploadingResume(true);

    try {
      const resumeRef = ref(storage, `resumes/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(resumeRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setFormData(prev => ({
        ...prev,
        resumeFile: file,
        resumeUrl: downloadURL,
        resumeFileName: file.name
      }));

      toast.success('Resume uploaded successfully');
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast.error('Failed to upload resume');
    } finally {
      setUploadingResume(false);
    }
  };


  const removeResume = () => {
    setFormData(prev => ({
      ...prev,
      resumeFile: null,
      resumeUrl: null,
      resumeFileName: null
    }));
    toast.success('Resume removed');
  };


  const isFormValid = formData.jobRole.trim() && formData.jobDescription.trim();


  const saveAndStartInterview = async () => {
    if (!isFormValid) {
      toast.error('Please fill in job role and description');
      return;
    }

    if (!auth.currentUser) {
      toast.error('Please log in to continue');
      navigate('/login');
      return;
    }

    if (!canCreateTemplate()) {
      toast.error(`Maximum templates (${templateState.templateLimit}) reached. Delete an existing template to create a new one.`);
      return;
    }

    setIsSubmitting(true);
    
    try {
      // UPDATED: Remove interview mode from template (will be selected per attempt)
      const templateData = {
        userId: auth.currentUser.uid,
        jobRole: formData.jobRole.trim(),
        jobDescription: formData.jobDescription.trim(),
        companyName: formData.companyName?.trim() || null,
        resumeUrl: formData.resumeUrl || null,
        resumeFileName: formData.resumeFileName || null,
        // REMOVED: interviewMode and questionCount
        createdAt: serverTimestamp(),
        attemptCount: 0,
        lastScore: null,
        lastGrade: null,
        lastSessionId: null,
        lastAttemptAt: null
      };

      const templateRef = await addDoc(collection(db, 'interviewTemplates'), templateData);
      
      setApplicationData({
        ...formData,
        templateId: templateRef.id,
        resumeContent: formData.resumeFileName ? `Resume file: ${formData.resumeFileName}` : null
      });

      toast.success('Interview template created successfully!');
      navigate(`/template/${templateRef.id}`);
      
    } catch (error) {
      console.error('Error creating interview template:', error);
      if (error.code === 'permission-denied') {
        toast.error('Permission denied. Please check your login status.');
      } else if (error.code === 'failed-precondition') {
        toast.error('Database index required. Check Firebase console.');
      } else {
        toast.error('Failed to create interview template');
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Create New Interview Template</h1>
              <span className="text-sm text-gray-500">
                ({userTemplateCount}/{templateState.templateLimit})
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Create Your AI Interview Template
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Create a reusable interview template for specific job roles. Each template allows up to {templateState.attemptLimit} practice attempts.
            </p>
          </div>

          {/* Template limit warning */}
          {userTemplateCount >= templateState.templateLimit - 1 && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-amber-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {userTemplateCount >= templateState.templateLimit 
                      ? 'Template Limit Reached' 
                      : 'Almost at Template Limit'}
                  </p>
                  <p className="text-sm text-amber-700">
                    {userTemplateCount >= templateState.templateLimit
                      ? `You have reached the maximum of ${templateState.templateLimit} templates. Delete an existing template to create a new one.`
                      : `You can create ${templateState.templateLimit - userTemplateCount} more template(s). Plan your interviews wisely.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="space-y-6">
              {/* Required Fields */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Required Information</h3>
                <p className="text-sm text-gray-600">These fields are mandatory to generate your personalized interview template</p>
              </div>

              {/* Job Role */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <Briefcase className="h-4 w-4" />
                  <span>Job Role *</span>
                </label>
                <input
                  type="text"
                  value={formData.jobRole}
                  onChange={(e) => handleInputChange('jobRole', e.target.value)}
                  placeholder="e.g., Software Engineer, Product Manager, Data Scientist"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.jobRole.length}/100 characters</p>
              </div>

              {/* Job Description */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4" />
                  <span>Job Description *</span>
                </label>
                <textarea
                  rows={6}
                  value={formData.jobDescription}
                  onChange={(e) => handleInputChange('jobDescription', e.target.value)}
                  placeholder="Paste the complete job description here. Include key responsibilities, required skills, qualifications, and any specific requirements. The more detailed, the better your interview questions will be."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  maxLength={2000}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.jobDescription.length}/2000 characters</p>
              </div>

              {/* Optional Fields Header */}
              <div className="border-b pb-4 pt-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Optional Enhancements</h3>
                <p className="text-sm text-gray-600">These fields will make your interview more personalized but are not required</p>
              </div>

              {/* Resume Upload */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4" />
                  <span>Resume Upload (Optional)</span>
                </label>
                
                {!formData.resumeFile ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                      id="resume-upload"
                      disabled={uploadingResume}
                    />
                    <label htmlFor="resume-upload" className="cursor-pointer">
                      {uploadingResume ? (
                        <div className="text-blue-600">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="font-medium">Uploading Resume...</p>
                          <p className="text-sm">Please wait</p>
                        </div>
                      ) : (
                        <div className="text-gray-500">
                          <FileText className="h-8 w-8 mx-auto mb-2" />
                          <p className="font-medium">Upload your resume</p>
                          <p className="text-sm">PDF, DOC, or DOCX (Max 5MB)</p>
                          <p className="text-xs mt-1">This helps generate more personalized questions</p>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="border-2 border-green-300 bg-green-50 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">Resume Uploaded Successfully</p>
                          <p className="text-sm text-green-700">{formData.resumeFileName}</p>
                          <p className="text-xs text-green-600">
                            Size: {(formData.resumeFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileUpload(e.target.files)}
                          className="hidden"
                          id="resume-replace"
                          disabled={uploadingResume}
                        />
                        <label
                          htmlFor="resume-replace"
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm cursor-pointer"
                        >
                          Replace
                        </label>
                        <button
                          onClick={removeResume}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Company Name */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <Building className="h-4 w-4" />
                  <span>Company Name (Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="e.g., Google, Microsoft, OpenAI"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Company-specific questions will be generated if provided
                </p>
              </div>

              {/* Template Benefits Info */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Template Benefits</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Reusable for multiple practice sessions</li>
                  <li>• Track your progress over {templateState.attemptLimit} attempts</li>
                  <li>• Compare scores and improvements</li>
                  <li>• Choose interview mode (Short/Standard/Comprehensive) per attempt</li>
                </ul>
              </div>

              {/* Create Template Button */}
              <button
                onClick={saveAndStartInterview}
                disabled={!isFormValid || isSubmitting || !canCreateTemplate() || uploadingResume}
                className="w-full flex items-center justify-center space-x-2 py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    <span>Create Interview Template</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

              {!isFormValid && (
                <p className="text-sm text-red-600 text-center">
                  Please fill in the required fields (Job Role and Job Description) to continue
                </p>
              )}
              
              {!canCreateTemplate() && (
                <p className="text-sm text-red-600 text-center">
                  Maximum template limit ({templateState.templateLimit}) reached. Delete an existing template first.
                </p>
              )}

              {uploadingResume && (
                <p className="text-sm text-blue-600 text-center">
                  Please wait while resume is uploading...
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
