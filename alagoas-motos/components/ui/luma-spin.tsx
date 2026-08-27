'use client'

export const Component = () => {
  return (
    <div className="relative aspect-square w-[65px]" aria-hidden="true">
      <span className="absolute animate-loaderAnim rounded-[50px] shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100" />
      <span className="animation-delay absolute animate-loaderAnim rounded-[50px] shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100" />
      <style jsx>{`
        @keyframes loaderAnim {
          0% {
            inset: 0 35px 35px 0;
          }
          12.5% {
            inset: 0 35px 0 0;
          }
          25% {
            inset: 35px 35px 0 0;
          }
          37.5% {
            inset: 35px 0 0 0;
          }
          50% {
            inset: 35px 0 0 35px;
          }
          62.5% {
            inset: 0 0 0 35px;
          }
          75% {
            inset: 0 0 35px 35px;
          }
          87.5% {
            inset: 0 0 35px 0;
          }
          100% {
            inset: 0 35px 35px 0;
          }
        }

        .animate-loaderAnim {
          animation: loaderAnim 2.5s infinite;
        }

        .animation-delay {
          animation-delay: -1.25s;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-loaderAnim {
            animation-duration: 5s;
          }
        }
      `}</style>
    </div>
  )
}
