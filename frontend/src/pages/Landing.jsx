// src/pages/Landing.jsx - Ultra-Modern Landing Page with Animations
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Brain, 
  Video, 
  Mic, 
  TrendingUp, 
  CheckCircle, 
  Star,
  Zap,
  Shield,
  Target,
  ArrowRight,
  Play,
  ChevronDown,
  BarChart3,
  Smile,
  FileText,
  Rocket,
  Check,
  X,
  Award,
  Clock,
  Users,
  MessageSquare,
  Heart,
  Code,
  Cpu,
  Eye,
  Globe
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [animatedStats, setAnimatedStats] = useState({ users: 0, success: 0, interviews: 0 });
  const [typedText, setTypedText] = useState('');
  const [currentRole, setCurrentRole] = useState(0);

  const roles = [
    'Software Engineer',
    'Product Manager',
    'Data Scientist',
    'Full Stack Developer',
    'UX Designer'
  ];

  // Typing animation effect
  useEffect(() => {
    let currentText = '';
    let currentIndex = 0;
    const role = roles[currentRole];
    
    const typingInterval = setInterval(() => {
      if (currentIndex < role.length) {
        currentText += role[currentIndex];
        setTypedText(currentText);
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setTimeout(() => {
          const deletingInterval = setInterval(() => {
            currentText = currentText.slice(0, -1);
            setTypedText(currentText);
            if (currentText === '') {
              clearInterval(deletingInterval);
              setCurrentRole((prev) => (prev + 1) % roles.length);
            }
          }, 50);
        }, 2000);
      }
    }, 100);

    return () => clearInterval(typingInterval);
  }, [currentRole]);

  // Animated counter effect
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setAnimatedStats({
        users: Math.floor((50000 / steps) * step),
        success: Math.floor((100 / steps) * step),
        interviews: Math.floor((500000 / steps) * step)
      });
      
      if (step >= steps) clearInterval(timer);
    }, increment);

    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGetStarted = () => {
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg shadow-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg animate-gradient">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                InterviewAI
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('features')} className="text-gray-700 hover:text-purple-600 transition-colors font-medium">
                Features
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="text-gray-700 hover:text-purple-600 transition-colors font-medium">
                How It Works
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-gray-700 hover:text-purple-600 transition-colors font-medium">
                Pricing
              </button>
              <button 
                onClick={handleGetStarted}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium animate-gradient"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-8 animate-bounce-slow">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">AI-Powered Interview Mastery</span>
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">NEW</span>
            </div>

            {/* Main Heading with Typing Animation */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
              Ace Your Interview as a
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent relative">
                {typedText}
                <span className="animate-blink">|</span>
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Practice with advanced AI that understands emotions, analyzes speech patterns, and 
              generates a comprehensive performance report to help you land your dream job.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button 
                onClick={handleGetStarted}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white text-lg font-semibold rounded-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 animate-gradient overflow-hidden"
              >
                <span className="relative z-10 flex items-center space-x-2">
                  <span>Start Free Trial</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              <button 
                onClick={() => scrollToSection('features')}
                className="group px-8 py-4 bg-white text-gray-700 text-lg font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg border-2 border-gray-200 hover:border-purple-300"
              >
                <span className="flex items-center space-x-2">
                  <Play className="h-5 w-5 text-purple-600 group-hover:scale-110 transition-transform" />
                  <span>See How It Works</span>
                </span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>7-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Animated Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="group relative bg-white/60 backdrop-blur-lg rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-purple-300 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {animatedStats.users.toLocaleString()}+
                </div>
                <div className="text-gray-600 font-medium flex items-center">
                  <Users className="h-5 w-5 mr-2 text-purple-600" />
                  Students Trained
                </div>
              </div>
            </div>

            <div className="group relative bg-white/60 backdrop-blur-lg rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-purple-300 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                  {animatedStats.success}%
                </div>
                <div className="text-gray-600 font-medium flex items-center">
                  <Trophy className="h-5 w-5 mr-2 text-green-600" />
                  Personalized
                </div>
              </div>
            </div>

            <div className="group relative bg-white/60 backdrop-blur-lg rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-purple-300 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-pink-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  {(animatedStats.interviews / 1000).toFixed(0)}K+
                </div>
                <div className="text-gray-600 font-medium flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-orange-600" />
                  Mock Interviews
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-block px-4 py-2 bg-purple-100 rounded-full mb-4">
              <span className="text-purple-700 font-semibold text-sm">FEATURES</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Everything You Need to
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Master Any Interview
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform combines cutting-edge technology with proven interview techniques
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards with Hover Effects */}
            {[
              {
                icon: <Smile className="h-10 w-10" />,
                title: 'Emotion Intelligence',
                description: 'Real-time emotional feedback to perfect your non-verbal communication and body language during interviews.',
                gradient: 'from-blue-500 to-cyan-500',
                bgGradient: 'from-blue-50 to-cyan-50'
              },
              {
                icon: <Brain className="h-10 w-10" />,
                title: 'AI-Powered Analysis',
                description: 'Advanced algorithms evaluate your answers with industry-specific insights and personalized career guidance.',
                gradient: 'from-purple-500 to-pink-500',
                bgGradient: 'from-purple-50 to-pink-50'
              },
              {
                icon: <Video className="h-10 w-10" />,
                title: 'Smart Proctoring',
                description: 'Simulate real interview conditions with intelligent monitoring that tracks attention and professional behavior.',
                gradient: 'from-green-500 to-emerald-500',
                bgGradient: 'from-green-50 to-emerald-50'
              },
              {
                icon: <Mic className="h-10 w-10" />,
                title: 'Speech Analytics',
                description: 'Get detailed metrics on pace, clarity, filler words, and confidence to refine your communication style.',
                gradient: 'from-orange-500 to-red-500',
                bgGradient: 'from-orange-50 to-red-50'
              },
              {
                icon: <Zap className="h-10 w-10" />,
                title: 'Flexible Practice Modes',
                description: 'Choose from quick warmups to comprehensive full-length interviews tailored to your schedule and needs.',
                gradient: 'from-yellow-500 to-orange-500',
                bgGradient: 'from-yellow-50 to-orange-50'
              },
              {
                icon: <BarChart3 className="h-10 w-10" />,
                title: 'Detailed Reports',
                description: 'Comprehensive performance analytics with actionable insights, progress tracking, and improvement roadmaps.',
                gradient: 'from-indigo-500 to-purple-500',
                bgGradient: 'from-indigo-50 to-purple-50'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-transparent hover:-translate-y-2 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                <div className="relative">
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
<section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative overflow-hidden">
  {/* Decorative Elements */}
  <div className="absolute top-0 left-0 w-full h-full opacity-5">
    <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full filter blur-3xl"></div>
    <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl"></div>
  </div>

  <div className="max-w-7xl mx-auto relative z-10">
    <div className="text-center mb-20">
      <div className="inline-block px-4 py-2 bg-blue-100 rounded-full mb-4">
        <span className="text-blue-700 font-semibold text-sm">HOW IT WORKS</span>
      </div>
      <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
        Get Started in
        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> 4 Simple Steps</span>
      </h2>
      <p className="text-xl text-gray-600 max-w-3xl mx-auto">
        From setup to success in minutes
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      {/* Step 1 */}
      <div className="relative group">
        <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent -z-10"></div>
        
        <div className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-purple-300 group-hover:-translate-y-2">
          {/* Step Number */}
          <div className="absolute -top-6 -left-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <span className="text-white font-bold text-lg">01</span>
          </div>

          {/* Icon */}
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform">
            <FileText className="h-8 w-8" />
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-gray-900 mb-3">Create Profile</h3>
          <p className="text-gray-600 leading-relaxed">Add your target role and job description for personalized questions</p>
        </div>
      </div>

      {/* Step 2 */}
      <div className="relative group">
        <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent -z-10"></div>
        
        <div className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-purple-300 group-hover:-translate-y-2">
          {/* Step Number */}
          <div className="absolute -top-6 -left-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <span className="text-white font-bold text-lg">02</span>
          </div>

          {/* Icon */}
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform">
            <Target className="h-8 w-8" />
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-gray-900 mb-3">Choose Mode</h3>
          <p className="text-gray-600 leading-relaxed">Select interview length based on your available time and goals</p>
        </div>
      </div>

      {/* Step 3 */}
      <div className="relative group">
        <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent -z-10"></div>
        
        <div className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-purple-300 group-hover:-translate-y-2">
          {/* Step Number */}
          <div className="absolute -top-6 -left-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <span className="text-white font-bold text-lg">03</span>
          </div>

          {/* Icon - FIXED! */}
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform">
            <Mic className="h-8 w-8" />
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-gray-900 mb-3">Practice Live</h3>
          <p className="text-gray-600 leading-relaxed">Answer AI-generated questions with real-time feedback and monitoring</p>
        </div>
      </div>

      {/* Step 4 */}
      <div className="relative group">
        <div className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-purple-300 group-hover:-translate-y-2">
          {/* Step Number */}
          <div className="absolute -top-6 -left-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <span className="text-white font-bold text-lg">04</span>
          </div>

          {/* Icon */}
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform">
            <TrendingUp className="h-8 w-8" />
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-gray-900 mb-3">Get Insights</h3>
          <p className="text-gray-600 leading-relaxed">Review detailed reports with scores, analytics, and improvement tips</p>
        </div>
      </div>
    </div>
  </div>
</section>


      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-green-100 rounded-full mb-4">
              <span className="text-green-700 font-semibold text-sm">PRICING</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Choose the perfect plan for your interview preparation journey
            </p>
            
            {/* Billing Toggle */}
            <div className="inline-flex items-center space-x-4 bg-white rounded-xl p-2 shadow-lg border border-gray-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  billingCycle === 'monthly'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 relative ${
                  billingCycle === 'yearly'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="absolute -top-2 -right-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full font-bold shadow-lg animate-pulse">
                  -20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Free Plan */}
            <div className="relative bg-white rounded-3xl p-8 shadow-lg border-2 border-gray-200 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-5xl font-bold text-gray-900">₹0</span>
                </div>
                <p className="text-gray-500">Forever free</p>
              </div>
              <ul className="space-y-4 mb-8">
                {['1 interview template', '1 attempt per template', 'Short mode (3-5 Q)', 'Basic reports'].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
                <li className="flex items-start">
                  <X className="h-5 w-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400">Advanced analytics</span>
                </li>
              </ul>
              <button 
                onClick={handleGetStarted}
                className="w-full py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200"
              >
                Get Started
              </button>
            </div>

            {/* Student Plan */}
            <div className="relative bg-white rounded-3xl p-8 shadow-xl border-2 border-blue-200 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg">
                POPULAR
              </div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Student</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-5xl font-bold text-gray-900">
                    ₹{billingCycle === 'monthly' ? '299' : '239'}
                  </span>
                  <span className="text-gray-500 ml-2">/month</span>
                </div>
                <p className="text-gray-500">Perfect for beginners</p>
              </div>
              <ul className="space-y-4 mb-8">
                {['3 interview templates', '2 attempts per template', 'Short + Standard modes', 'Full emotion analysis', 'Downloadable reports'].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={handleGetStarted}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200"
              >
                Start Free Trial
              </button>
            </div>

            {/* Pro Plan - Featured */}
            <div className="relative bg-gradient-to-br from-purple-600 via-blue-600 to-pink-600 rounded-3xl p-8 shadow-2xl transform scale-105 hover:scale-110 transition-all duration-300 text-white">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full shadow-lg animate-pulse">
                BEST VALUE
              </div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-5xl font-bold">
                    ₹{billingCycle === 'monthly' ? '599' : '479'}
                  </span>
                  <span className="text-purple-100 ml-2">/month</span>
                </div>
                <p className="text-purple-100">Most popular choice</p>
              </div>
              <ul className="space-y-4 mb-8">
                {['5 interview templates', '3 attempts per template', 'All modes (3-15 Q)', 'Advanced analytics', 'Priority AI evaluation', 'Career guidance'].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-5 w-5 text-yellow-300 mr-3 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={handleGetStarted}
                className="w-full py-3 px-6 bg-white text-purple-600 font-semibold rounded-xl hover:bg-gray-100 hover:shadow-xl transition-all duration-200"
              >
                Start Free Trial
              </button>
            </div>

            {/* Premium Plan */}
            <div className="relative bg-white rounded-3xl p-8 shadow-lg border-2 border-gray-200 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 text-xs font-bold rounded-full shadow-lg">
                UNLIMITED
              </div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-5xl font-bold text-gray-900">
                    ₹{billingCycle === 'monthly' ? '999' : '799'}
                  </span>
                  <span className="text-gray-500 ml-2">/month</span>
                </div>
                <p className="text-gray-500">Unlimited everything</p>
              </div>
              <ul className="space-y-4 mb-8">
                {['Unlimited templates', 'Unlimited attempts', 'Custom questions', 'Expert AI insights', 'Resume optimization', 'Priority support'].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={handleGetStarted}
                className="w-full py-3 px-6 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200"
              >
                Start Free Trial
              </button>
            </div>
          </div>

          <p className="text-center text-gray-500 mt-12">
            All plans include 7-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-yellow-100 rounded-full mb-4">
              <span className="text-yellow-700 font-semibold text-sm">TESTIMONIALS</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Loved by Students Worldwide
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Rahul Kumar',
                role: 'Software Engineer',
                company: 'Tech Giant',
                avatar: 'RK',
                text: 'The real-time feedback helped me understand my body language. Landed my dream job within 2 months!',
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                name: 'Priya Sharma',
                role: 'Product Manager',
                company: 'E-commerce Leader',
                avatar: 'PS',
                text: 'Incredibly detailed insights! It\'s like having a personal interview coach available 24/7.',
                gradient: 'from-purple-500 to-pink-500'
              },
              {
                name: 'Arjun Mehta',
                role: 'Data Scientist',
                company: 'Cloud Provider',
                avatar: 'AM',
                text: 'The comprehensive mode really prepared me for tough technical interviews. Speech analysis was a game-changer!',
                gradient: 'from-green-500 to-emerald-500'
              }
            ].map((testimonial, index) => (
              <div key={index} className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-transparent hover:-translate-y-2">
                <div className={`absolute inset-0 bg-gradient-to-br ${testimonial.gradient} opacity-0 group-hover:opacity-10 rounded-3xl transition-opacity`}></div>
                <div className="relative">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed italic">
                    "{testimonial.text}"
                  </p>
                  <div className="flex items-center">
                    <div className={`h-14 w-14 bg-gradient-to-br ${testimonial.gradient} rounded-full flex items-center justify-center mr-4 shadow-lg`}>
                      <span className="text-white font-bold text-lg">{testimonial.avatar}</span>
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{testimonial.name}</div>
                      <div className="text-sm text-gray-600">{testimonial.role}</div>
                      <div className="text-xs text-gray-500">{testimonial.company}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-indigo-100 rounded-full mb-4">
              <span className="text-indigo-700 font-semibold text-sm">FAQ</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'How does the emotion analysis work?',
                a: 'Our platform uses advanced computer vision technology to analyze facial expressions in real-time, providing insights into your emotional state and non-verbal communication patterns throughout the interview.'
              },
              {
                q: 'What interview modes are available?',
                a: 'We offer three modes: Short (3-5 questions, ~15-20 mins), Standard (6-10 questions, ~30-40 mins), and Comprehensive (11-15 questions, ~50-60 mins). Choose based on your schedule and preparation needs.'
              },
              {
                q: 'How accurate is the feedback?',
                a: 'Our AI evaluation system is trained on thousands of successful interviews and provides highly accurate, personalized feedback on technical content, communication skills, and professional presentation.'
              },
              {
                q: 'Can I practice for specific companies?',
                a: 'Yes! Add company names to your templates, and our AI will generate company-specific questions based on hiring patterns and organizational culture.'
              },
              {
                q: 'Is my data secure?',
                a: 'Absolutely. We use enterprise-grade encryption and secure cloud storage. Your interview data is never shared with third parties and you maintain full control over your information.'
              },
              {
                q: 'Can I resume an interrupted interview?',
                a: 'Yes! Our system automatically saves your progress. If you lose connection or close the tab, you can resume exactly where you left off.'
              },
              {
                q: 'What\'s included in the reports?',
                a: 'Reports include overall scores, detailed question-by-question analysis, emotional intelligence metrics, speech analytics, strengths and improvements, and personalized career guidance.'
              },
              {
                q: 'Do I need special equipment?',
                a: 'Just a computer with webcam and microphone. Our platform works with standard hardware and modern web browsers.'
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 hover:border-purple-200 transition-all duration-200">
                <button
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                  className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-8">{faq.q}</span>
                  <ChevronDown 
                    className={`h-5 w-5 text-purple-600 flex-shrink-0 transform transition-transform duration-200 ${
                      activeFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {activeFaq === index && (
                  <div className="px-8 pb-6">
                    <p className="text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-gradient"></div>
        <div className="absolute inset-0 bg-black opacity-10"></div>
        
        <div className="relative max-w-4xl mx-auto text-center text-white z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Ace Your Next Interview?
          </h2>
          <p className="text-xl text-purple-100 mb-10 max-w-2xl mx-auto">
            Join 50,000+ students who have successfully landed their dream jobs with our AI-powered platform
          </p>
          <button 
            onClick={handleGetStarted}
            className="inline-flex items-center space-x-3 px-10 py-5 bg-white text-purple-600 text-lg font-bold rounded-xl hover:bg-gray-100 hover:scale-105 transition-all duration-200 shadow-2xl"
          >
            <span>Start Your Free Trial Today</span>
            <Rocket className="h-6 w-6" />
          </button>
          <p className="mt-6 text-sm text-purple-100">
            No credit card required • 7-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg animate-gradient">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <span className="text-2xl font-bold">InterviewAI</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Master interviews with AI-powered intelligence and land your dream job.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Product</h3>
              <ul className="space-y-3">
                {['Features', 'Pricing', 'How It Works', 'FAQ'].map((item) => (
                  <li key={item}>
                    <button 
                      onClick={() => scrollToSection(item.toLowerCase().replace(' ', '-'))}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Company</h3>
              <ul className="space-y-3">
                {['About Us', 'Blog', 'Careers', 'Contact'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Legal</h3>
              <ul className="space-y-3">
                {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-gray-400">
              © 2025 InterviewAI. All rights reserved. Made with <Heart className="inline h-4 w-4 text-red-500" /> for aspiring professionals.
            </p>
          </div>
        </div>
      </footer>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </div>
  );
}

function Trophy({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
