import React from 'react'

function TermsOfUse() {
  return (
    <div className="space-y-6 pb-16">
      <div>
        <h2 className="text-xl font-medium">Terms of Use</h2>
        <p className="text-sm text-aviation-text-secondary mt-1">
          Terms and conditions for using Vat-Officer
        </p>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium mb-4">Terms and Conditions</h3>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          By using Vat-Officer, you agree to the following terms:
        </p>

        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Use at Your Own Risk</h4>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          Vat-Officer is provided as-is without any warranties. The application is 
          in active development and may contain bugs or incomplete features. Use of 
          this tool is at your own risk.
        </p>

        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Accuracy of Information</h4>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          While we strive to provide accurate information, data from third-party 
          sources (such as VATSIM) may not always be current or correct. Always verify 
          critical information through official sources before use.
        </p>

        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">VATSIM Compliance</h4>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          Users are responsible for ensuring their use of Vat-Officer complies with 
          all VATSIM rules and regulations. This tool is not affiliated with or 
          endorsed by VATSIM.
        </p>

        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Modifications</h4>
        <p className="text-aviation-text-secondary leading-relaxed">
          These terms may be updated at any time. Continued use of the application 
          constitutes acceptance of any changes.
        </p>
      </div>
    </div>
  )
}

export default TermsOfUse
