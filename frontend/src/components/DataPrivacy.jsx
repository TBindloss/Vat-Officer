import React from 'react'

function DataPrivacy() {
  return (
    <div className="space-y-6 pb-16">
      <div>
        <h2 className="text-xl font-medium">Data Privacy</h2>
        <p className="text-sm text-aviation-text-secondary mt-1">
          How we handle your data
        </p>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium mb-4">Privacy Policy</h3>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          This privacy policy explains how Vat-Officer handles your data and what 
          information is stored or transmitted.
        </p>
        
        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Data Storage</h4>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          All data entered into Vat-Officer is stored locally in your browser using 
          localStorage. This includes:
        </p>
        <ul className="space-y-2 text-aviation-text-secondary mb-4">
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>Checklist data and progress</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>Flight data entries</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>ACARS configuration (logon codes, callsigns)</span>
          </li>
        </ul>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          No data is sent to external servers except when explicitly required for 
          functionality (such as VATSIM API calls or ACARS message transmission).
        </p>

        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Third-Party Services</h4>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          Vat-Officer may interact with the following third-party services:
        </p>
        <ul className="space-y-2 text-aviation-text-secondary mb-4">
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>VATSIM API - for controller and ATIS data</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>Hoppie ACARS - for ACARS messaging functionality</span>
          </li>
        </ul>

        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Data Security</h4>
        <p className="text-aviation-text-secondary leading-relaxed">
          Since all data is stored locally in your browser, you have full control. 
          Clearing your browser data will remove all stored information. We recommend 
          being cautious with sensitive information like ACARS logon codes.
        </p>
      </div>
    </div>
  )
}

export default DataPrivacy
