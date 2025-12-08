import React from 'react';

const PageHeader = ({ title, subtitle, icon: Icon, actions }) => (
  <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-6">
    <div className="text-center sm:text-left">
      <h1 className="text-3xl font-bold flex items-center justify-center sm:justify-start gap-3 text-cyan-400">
        <Icon size={32} /> {title}
      </h1>
      <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
    </div>
    <div className="flex gap-3">{actions}</div>
  </div>
);

export default PageHeader;