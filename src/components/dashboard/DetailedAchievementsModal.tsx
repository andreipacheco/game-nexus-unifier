import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { XboxDetailedAchievement } from '@/contexts/XboxContext'; // Adjust path if necessary
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, ImageOff } from 'lucide-react'; // Added ImageOff

interface DetailedAchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  achievements: XboxDetailedAchievement[] | null;
  isLoading: boolean;
  error: string | null;
}

export const DetailedAchievementsModal: React.FC<DetailedAchievementsModalProps> = ({
  isOpen,
  onClose,
  gameName,
  achievements,
  isLoading,
  error,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Achievements: {gameName}</DialogTitle>
          {/* <DialogDescription>
            Detailed list of achievements for {gameName}.
          </DialogDescription> */}
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6"> {/* Negative margin to compensate for pr if scrollbar appears */}
          {isLoading && (
            <div className="space-y-3 p-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-2 border rounded-md">
                  <Skeleton className="h-12 w-12 rounded-md flex-shrink-0" />
                  <div className="space-y-2 flex-grow">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="text-red-500 flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="h-10 w-10 mb-3 text-red-400" />
              <p className="font-semibold">Error Loading Achievements</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
          {!isLoading && !error && achievements && achievements.length === 0 && (
            <p className="text-center text-muted-foreground p-6">No achievements found for this game.</p>
          )}
          {!isLoading && !error && achievements && achievements.length > 0 && (
            <ul className="space-y-2 p-1">
              {achievements.map((ach) => (
                <li
                  key={ach.id}
                  className={`p-3 border rounded-lg flex items-start space-x-4 transition-colors
                              ${ach.isUnlocked
                                ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-800/30'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                >
                  {ach.iconUrl ? (
                    <img
                      src={ach.iconUrl}
                      alt={ach.name}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-md object-cover flex-shrink-0 border dark:border-slate-600"
                      onError={(e) => {
                        // Hide image and show placeholder if error
                        const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                        if (placeholder && placeholder.classList.contains('icon-placeholder')) {
                          placeholder.style.display = 'flex';
                        }
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  {/* Placeholder for missing iconUrl or on error */}
                  <div
                    className={`icon-placeholder w-14 h-14 md:w-16 md:h-16 rounded-md bg-slate-200 dark:bg-slate-700 flex-shrink-0 items-center justify-center text-slate-400 dark:text-slate-500 ${ach.iconUrl ? 'hidden' : 'flex'}`}
                  >
                    <ImageOff size={24} />
                  </div>

                  <div className="flex-grow">
                    <h4 className={`font-semibold text-sm md:text-base ${ach.isUnlocked ? 'text-green-700 dark:text-green-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {ach.name}
                      {ach.isUnlocked && <CheckCircle2 className="inline h-4 w-4 md:h-5 md:w-5 text-green-500 dark:text-green-400 ml-1.5 align-text-bottom" />}
                    </h4>
                    <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-0.5">{ach.description || ach.howToUnlock || 'No description available.'}</p>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1.5 space-x-2">
                      <span className="font-medium">{ach.gamerscore} GS</span>
                      {ach.rarityPercent !== undefined && ach.rarityPercent > 0 && (
                        <span className="border-l border-slate-300 dark:border-slate-600 pl-2">{ach.rarityPercent.toFixed(1)}% Rarity</span>
                      )}
                      {ach.isUnlocked && ach.unlockedTime && (
                        <span className="border-l border-slate-300 dark:border-slate-600 pl-2">
                          Unlocked: {new Date(ach.unlockedTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter className="mt-auto pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
