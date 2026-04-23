"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: "Free",
    yearlyPrice: "Free",
    monthlyPeriod: "",
    yearlyPeriod: "",
    description: "For the casual host",
    features: [
      "1 calendar",
      "5 AI plan ideas per week",
      "Up to 50 RSVPs",
      "Schedule 2 weeks ahead",
    ],
  },
  {
    id: "growth",
    name: "The Social",
    monthlyPrice: "$4.99",
    yearlyPrice: "$49.99",
    monthlyPeriod: "/mo",
    yearlyPeriod: "/yr",
    yearlySavings: "Save 17%",
    description: "For the individual connector who wants more control and a premium look",
    highlight: true,
    features: [
      "1 calendar",
      "10 AI plan ideas per week",
      "Unlimited RSVPs",
      "Unlimited scheduling",
      "Custom branding",
      "Day & category preferences",
      "RSVP management",
    ],
  },
  {
    id: "pro",
    name: "The Organizer",
    monthlyPrice: "$9.99",
    yearlyPrice: "$99.99",
    monthlyPeriod: "/mo",
    yearlyPeriod: "/yr",
    yearlySavings: "Save 17%",
    description: "For building a brand, managing co-hosts, and scaling your community",
    features: [
      "Unlimited calendars",
      "15 AI plan ideas per week",
      "Unlimited RSVPs",
      "Unlimited scheduling",
      "Custom branding",
      "All preferences",
      "Analytics dashboard",
      "On-demand generation",
    ],
  },
];

interface SubscriptionModalProps {
  currentTier: string;
  onSelect: (tier: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function SubscriptionModal({
  currentTier,
  onSelect,
  onClose,
  loading = false,
}: SubscriptionModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-t-2xl md:rounded-xl p-6 md:p-10 max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 transition-colors"
        >
          <Plus className="w-6 h-6 rotate-45" />
        </button>

        <h2 className="text-2xl font-light tracking-tight mb-1">
          Choose your plan
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Upgrade to unlock more features for your organization.
        </p>

        {/* Billing period toggle */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full transition-colors ${
              billingPeriod === "monthly"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod("yearly")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full transition-colors ${
              billingPeriod === "yearly"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            Yearly
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.id === currentTier;
            const price = billingPeriod === "yearly" ? tier.yearlyPrice : tier.monthlyPrice;
            const period = billingPeriod === "yearly" ? tier.yearlyPeriod : tier.monthlyPeriod;
            return (
              <div
                key={tier.id}
                className={`border rounded-xl p-5 flex flex-col ${
                  tier.highlight
                    ? "border-zinc-900 ring-1 ring-zinc-900"
                    : "border-zinc-200"
                } ${isCurrent ? "bg-zinc-50" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold uppercase tracking-widest">
                    {tier.name}
                  </h3>
                  {tier.highlight && (
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-900 text-white px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-0.5 mb-1">
                  <span className="text-3xl font-light">{price}</span>
                  {period && (
                    <span className="text-sm text-zinc-400">{period}</span>
                  )}
                </div>
                {billingPeriod === "yearly" && tier.yearlySavings && (
                  <span className="text-xs text-green-600 font-medium mb-1">
                    {tier.yearlySavings}
                  </span>
                )}
                <p className="text-xs text-zinc-500 mb-4">{tier.description}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-zinc-700">
                      <Check className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => !isCurrent && onSelect(tier.id)}
                  disabled={isCurrent || loading}
                  className={`w-full py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${
                    isCurrent
                      ? "bg-zinc-100 text-zinc-400 cursor-default"
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                  } disabled:opacity-50`}
                >
                  {isCurrent ? "Current Plan" : loading ? "Updating..." : `Switch to ${tier.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
