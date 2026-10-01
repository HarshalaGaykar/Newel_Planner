import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, Award, ShieldCheck, Calendar, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrainingEnrollment } from '@/lib/training-api';

interface CertificateModalProps {
  enrollment: TrainingEnrollment;
  userName: string;
  onClose: () => void;
}

export function CertificateModal({ enrollment, userName, onClose }: CertificateModalProps) {
  const { certificate, session } = enrollment;
  if (!certificate || !session) return null;

  const programName = session.title || session.program.name;
  const dateStr = new Date(certificate.issuedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:backdrop-blur-none" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-5xl shadow-2xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none print:w-full print:max-w-none"
        >
          {/* Toolbar - hidden during print */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50 print:hidden">
            <div className="flex items-center gap-2">
              <Award className="text-amber-500" size={20} />
              <span className="font-bold text-gray-700">Course Certificate</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Printer size={16} /> Print / Save PDF
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Certificate Body */}
          <div className="p-12 print:p-8 bg-white overflow-hidden relative">
            {/* Background Ornaments */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full translate-x-1/3 translate-y-1/3" />
            
            {/* Border Design */}
            <div className="border-[12px] border-amber-100 p-2 rounded-lg relative z-10">
              <div className="border-4 border-amber-500/20 p-12 print:p-8 flex flex-col items-center text-center space-y-8 bg-white/80 backdrop-blur-[2px]">
                
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                      <Award size={40} />
                    </div>
                  </div>
                  <h1 className="text-4xl font-serif font-black tracking-tighter text-gray-900 uppercase">
                    Certificate of Completion
                  </h1>
                  <p className="text-amber-600 font-bold tracking-[0.2em] uppercase text-sm">
                    Excellence in Professional Development
                  </p>
                </div>

                <div className="space-y-6 w-full max-w-2xl">
                  <p className="text-gray-500 italic font-serif">This is to certify that</p>
                  
                  <div>
                    <h2 className="text-5xl font-serif font-bold text-gray-800 border-b-2 border-gray-100 inline-block pb-2 px-8 min-w-[300px]">
                      {userName}
                    </h2>
                  </div>

                  <p className="text-gray-500 italic font-serif">has successfully completed the enterprise training program</p>
                  
                  <div className="py-4">
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                      {programName}
                    </h3>
                    <div className="flex items-center justify-center gap-4 mt-2 text-sm text-amber-700 font-bold uppercase tracking-widest">
                      <span>{session.program.type} Training</span>
                      <span>•</span>
                      <span>{session.program.durationHrs} Hours</span>
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="grid grid-cols-2 gap-20 w-full max-w-3xl pt-12">
                  <div className="text-left space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={10} /> Date of Issue
                      </p>
                      <p className="font-bold text-gray-800">{dateStr}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Hash size={10} /> Certificate No
                      </p>
                      <p className="font-mono text-xs font-bold text-amber-600">{certificate.certificateNo}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-end">
                    <div className="w-48 border-b-2 border-gray-900 mb-2" />
                    <p className="text-xs font-bold text-gray-900 uppercase tracking-widest">Director of Learning</p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-600 font-bold">
                      <ShieldCheck size={12} />
                      Digitally Verified
                    </div>
                  </div>
                </div>

                {/* Seal */}
                <div className="absolute top-8 right-8 w-24 h-24 opacity-10 pointer-events-none grayscale">
                  <Award size={96} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
