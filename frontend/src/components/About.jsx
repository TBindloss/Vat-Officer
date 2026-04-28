import React from 'react'

function About() {
  return (
    <div className="space-y-6 pb-16">
      <div>
        <h2 className="text-xl font-medium">About</h2>
        <p className="text-sm text-aviation-text-secondary mt-1">
          Learn more about Vat-Officer
        </p>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium mb-4">What is Vat-Officer?</h3>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          Vat-Officer is a digital kneeboard application designed for VATSIM pilots. 
          It provides tools to help organize and manage your flight information, checklists, 
          and communications in one convenient place.
        </p>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          This application is built by an individual who cares about making VATSIM flying 
          more organized and enjoyable. It's not a corporate product—just a personal project 
          that aims to be useful for the community.
        </p>
        <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Features</h4>
        <ul className="space-y-2 text-aviation-text-secondary">
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>Custom checklist management with progress tracking</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>Flight data scratchpad for quick reference</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>Live VATSIM controller frequency lookup</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-aviation-accent">•</span>
            <span>ACARS messaging via Hoppie's network</span>
          </li>
        </ul>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium mb-4">Development Status</h3>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          This application is currently in active development. Features may change, 
          and some functionality may not be fully complete. Your feedback and suggestions 
          are welcome.
        </p>
        <p className="text-aviation-text-secondary">
          <span className="font-medium">Version:</span> 0.1.5
        </p>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium mb-4">Transparency</h3>
        <p className="text-aviation-text-secondary leading-relaxed mb-4">
          Vat-Officer is a personal project built to be useful for the community. It's not a corporate product—just a personal project. 
          I believe that transparency on the project is important and will be keeping this bit up to date with information about the project.

          <h4 className="text-md font-medium text-aviation-text mt-6 mb-3">Donations</h4>
          <p className="text-aviation-text-secondary leading-relaxed mb-4">
            If you find this application useful, you can use the 'Buy me a coffee' button to donate to the project and help me keep it running.
            Any donations are greatly appreciated and will be used exclusively to cover the costs of the project.
          </p>
        </p>
      </div>
    </div>

  )
}

export default About
