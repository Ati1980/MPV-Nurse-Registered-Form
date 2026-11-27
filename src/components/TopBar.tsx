import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';

export type ActivePage = 'overview' | 'apply' | 'track' | 'hr';

interface TopBarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onStartApply: () => void;
}

export function TopBar({ activePage, onNavigate, onStartApply }: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActivePage; label: string }[] = [
    { id: 'overview', label: 'ภาพรวมตำแหน่ง' },
    { id: 'apply', label: 'กรอกใบสมัคร' },
    { id: 'track', label: 'ติดตามสถานะ' },
    { id: 'hr', label: 'เจ้าหน้าที่ HR' },
  ];

  const handleNavClick = (page: ActivePage) => {
    setMobileMenuOpen(false);
    onNavigate(page);
  };

  return (
    <header className="no-print sticky top-0 z-40 w-full border-b border-white/65 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:h-16 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => handleNavClick('overview')}
          className="font-display text-base font-semibold tracking-tight text-teal-950 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 sm:text-lg"
        >
          โรงงานน้ำตาลมิตรภูเวียง
        </motion.button>

        {/* Zone 2: 4 Single-line Text Navigation Links */}
        <nav
          aria-label="เมนูหลัก"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-teal-900/75"
        >
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative py-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 ${
                  isActive
                    ? 'text-teal-950 font-semibold'
                    : 'text-teal-900/70 hover:text-teal-950'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="topbar-nav-underline"
                    aria-hidden="true"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-teal-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            type="button"
            whileHover={{ y: -1.5 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.16 }}
            onClick={() => {
              setMobileMenuOpen(false);
              onStartApply();
            }}
            className="hidden sm:inline-flex min-h-[40px] items-center justify-center rounded-xl bg-teal-800 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-teal-950/15 transition-colors hover:bg-teal-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            เริ่มกรอกใบสมัคร
          </motion.button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={mobileMenuOpen}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-teal-950 transition-colors hover:bg-teal-900/5 active:scale-95 md:hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-teal-900/10 bg-white/95 backdrop-blur-xl px-4 py-3 md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {navItems.map((item, index) => {
                const isActive = activePage === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.03 }}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex min-h-[44px] items-center rounded-xl px-3 text-left text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-teal-800/10 text-teal-950 font-semibold'
                        : 'text-teal-900/80 hover:bg-teal-900/5'
                    }`}
                  >
                    {item.label}
                  </motion.button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStartApply();
                }}
                className="btn-lift mt-2 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-medium text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                เริ่มกรอกใบสมัคร
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
