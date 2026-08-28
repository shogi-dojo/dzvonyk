import React from 'react';
import { Calendar, FileText, Shield, Code2 } from 'lucide-react';

// SPDX-License-Identifier: AGPL-3.0-or-later
const SOURCE_URL = 'https://github.com/shogi-dojo/dzvonyk';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer 
      className="no-print border-t border-border bg-card/50 mt-auto"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid gap-8 md:grid-cols-3">
          {/* About Section */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-foreground">Дзвоник</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Безкоштовний офлайн-планувальник шкільного розкладу для завуча.
              <br/>
              Побудовано на рушії FET; усі дані залишаються на вашому пристрої.
            </p>
          </div>          
          
          {/* Links Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              Legal
            </h3>
            <nav aria-label="Legal links">
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/privacy-policy.txt" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms-conditions.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Terms &amp; Conditions
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    title="AGPL §13 — вихідний код цієї версії"
                  >
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Вихідний код
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {currentYear} Дзвоник. Based on{' '}
            <a 
              href="https://lalescu.ro/liviu/fet/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              FET
            </a>{' '}
            by Liviu Lalescu. Licensed under{' '}
            <a 
              href="https://www.gnu.org/licenses/agpl-3.0.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              AGPL v3
            </a>.
          </p>
        </div>
      </div>
    </footer>
  );
}
