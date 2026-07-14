// src/pages/Pricing.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PricingCard from '../components/payment/PricingCard';
import PaymentModal from '../components/payment/PaymentModal';
import useStore from '../store/useStore';
import { auth } from '../firebase';

export default function Pricing() {
  const navigate = useNavigate();
  const { subscription } = useStore();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Get started with basics',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: {
        templateLimit: 1,
        attemptLimit: 1,
        modes: ['short'],
        emotionAnalysis: false,
        advancedReports: false,
        prioritySupport: false
      }
    },
    {
      id: 'student',
      name: 'Student',
      description: 'Perfect for beginners',
      monthlyPrice: 299,
      yearlyPrice: 2868,
      features: {
        templateLimit: 3,
        attemptLimit: 2,
        modes: ['short', 'standard'],
        emotionAnalysis: true,
        advancedReports: true,
        prioritySupport: false
      }
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Most popular choice',
      monthlyPrice: 599,
      yearlyPrice: 5748,
      features: {
        templateLimit: 5,
        attemptLimit: 3,
        modes: ['short', 'standard', 'comprehensive'],
        emotionAnalysis: true,
        advancedReports: true,
        prioritySupport: true
      }
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'Unlimited everything',
      monthlyPrice: 999,
      yearlyPrice: 9588,
      features: {
        templateLimit: Infinity,
        attemptLimit: Infinity,
        modes: ['short', 'standard', 'comprehensive'],
        emotionAnalysis: true,
        advancedReports: true,
        prioritySupport: true
      }
    }
  ];

  const getFeaturesList = (plan) => {
    const features = [
      {
        text: `${plan.features.templateLimit === Infinity ? 'Unlimited' : plan.features.templateLimit} interview template${plan.features.templateLimit > 1 ? 's' : ''}`,
        included: true
      },
      {
        text: `${plan.features.attemptLimit === Infinity ? 'Unlimited' : plan.features.attemptLimit} attempt${plan.features.attemptLimit > 1 ? 's' : ''} per template`,
        included: true
      },
      {
        text: `${plan.features.modes.join(' + ')} mode${plan.features.modes.length > 1 ? 's' : ''}`,
        included: true
      },
      {
        text: 'Emotion analysis',
        included: plan.features.emotionAnalysis
      },
      {
        text: 'Advanced reports',
        included: plan.features.advancedReports
      },
      {
        text: 'Priority support',
        included: plan.features.prioritySupport
      }
    ];
    return features;
  };

  const handlePlanSelect = (plan) => {
    if (!auth.currentUser) {
      navigate('/signin');
      return;
    }

    if (plan.id === 'free') {
      // Free plan - no payment needed
      navigate('/dashboard');
      return;
    }

    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Select the perfect plan for your interview preparation journey
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center space-x-4 bg-white rounded-xl p-2 shadow-lg border border-gray-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all relative ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-600'
              }`}
            >
              Yearly
              <span className="absolute -top-2 -right-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              price={billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
              billingCycle={billingCycle}
              features={getFeaturesList(plan)}
              isPopular={plan.id === 'student'}
              isCurrent={subscription.plan === plan.id}
              onSelect={handlePlanSelect}
            />
          ))}
        </div>

        <p className="text-center text-gray-500 mt-12">
          All paid plans include 7-day free trial • Cancel anytime
        </p>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          billingCycle={billingCycle}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
}
