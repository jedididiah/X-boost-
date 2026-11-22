import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ className = '', size = 'md' }: BrandLogoProps) {
  const iconDims = size === 'sm' ? 24 : size === 'lg' ? 34 : 28;
  const textClass =
    size === 'sm'
      ? 'text-lg'
      : size === 'lg'
        ? 'text-2xl'
        : 'text-xl';

  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none ${className}`}>
      <svg
        width={iconDims}
        height={iconDims}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="8"
          fill="#0B0C10"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.25"
        />
        <path
          d="M10.5 10L16.8 18.4L10.2 26H13.1L18.1 20.1L22.5 26H26.2L19.5 17L25.6 10H22.7L18.2 15.3L14.2 10H10.5Z"
          fill="#FFFFFF"
        />
        <path
          d="M23.5 9.5L26.5 9.5L26.5 12.5"
          stroke="#2563EB"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.5 15.5L26.2 9.8"
          stroke="#3B82F6"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-display font-bold tracking-tight text-white ${textClass}`}>
        𝕏 <span className="text-[#3B82F6]">Boost</span>
      </span>
    </span>
  );
}
