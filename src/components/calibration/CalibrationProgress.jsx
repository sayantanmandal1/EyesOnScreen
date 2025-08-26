/**
 * CalibrationProgress - Progress indicators for calibration steps
 */

export const CalibrationProgress = ({
  steps,
  currentStep
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                ${index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-600 text-gray-300'
                }
              `}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
            
            {/* Step label */}
            <div className="ml-3 hidden sm:block">
              <div
                className={`
                  text-sm font-medium
                  ${index <= currentStep ? 'text-white' : 'text-gray-400'}
                `}
              >
                {step.name}
              </div>
              <div className="text-xs text-gray-400">
                {step.description}
              </div>
            </div>
            
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  flex-1 h-0.5 mx-4
                  ${index < currentStep ? 'bg-green-500' : 'bg-gray-600'}
                `}
              />
            )}
          </div>
        ))}
      </div>
      
      {/* Overall progress bar */}
      <div className="w-full bg-gray-600 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>
      
      {/* Progress text */}
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>Step {currentStep + 1} of {steps.length}</span>
        <span>{Math.round(((currentStep + 1) / steps.length) * 100)}% Complete</span>
      </div>
    </div>
  );
};