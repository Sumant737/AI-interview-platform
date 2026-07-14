// src/components/payment/PricingCard.jsx
import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';

export default function PricingCard({ 
  plan, 
  price, 
  billingCycle, 
  features, 
  isPopular, 
  isCurrent,
  onSelect 
}) {
  const planColors = {
    free: 'border-gray-200',
    student: 'border-blue-300',
    pro: 'border-purple-500',
    premium: 'border-yellow-400'
  };

  const buttonColors = {
    free: 'bg-gray-600 hover:bg-gray-700',
    student: 'bg-blue-600 hover:bg-blue-700',
    pro: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700',
    premium: 'bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-gray-900'
  };

  return (
    <div className={`relative bg-white rounded-3xl p-8 shadow-lg border-2 ${planColors[plan.id]} hover:shadow-2xl transition-all duration-300 ${plan.id === 'pro' ? 'transform scale-105' : ''}`}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
          POPULAR
        </div>
      )}
      
      {isCurrent && (
        <div className="absolute -top-4 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center space-x-1">
          <Check className="h-3 w-3" />
          <span>CURRENT PLAN</span>
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2 capitalize">{plan.name}</h3>
        <div className="flex items-baseline mb-2">
          <span className="text-5xl font-bold text-gray-900">
            ₹{price}
          </span>
          {price > 0 && <span className="text-gray-500 ml-2">/month</span>}
        </div>
        <p className="text-gray-500">{plan.description}</p>
      </div>

      <ul className="space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            {feature.included ? (
              <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
            ) : (
              <X className="h-5 w-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
            )}
            <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan)}
        disabled={isCurrent}
        className={`w-full py-3 px-6 font-semibold rounded-xl transition-all duration-200 ${
          isCurrent 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : `${buttonColors[plan.id]} text-white shadow-md hover:shadow-lg`
        }`}
      >
        {isCurrent ? 'Current Plan' : price === 0 ? 'Get Started' : 'Upgrade Now'}
      </button>
    </div>
  );
}
