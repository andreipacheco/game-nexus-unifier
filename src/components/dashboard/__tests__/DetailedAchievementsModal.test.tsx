import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DetailedAchievementsModal } from '../DetailedAchievementsModal';
import { XboxDetailedAchievement } from '@/contexts/XboxContext'; // Adjust path as needed

// Mock lucide-react icons for simplicity in tests
jest.mock('lucide-react', () => {
  const original = jest.requireActual('lucide-react');
  return {
    ...original,
    AlertTriangle: () => <div data-testid="alert-icon">Alert</div>,
    CheckCircle2: () => <div data-testid="check-icon">Check</div>,
    ImageOff: () => <div data-testid="image-off-icon">ImageOff</div>,
  };
});

describe('DetailedAchievementsModal', () => {
  const mockOnClose = jest.fn();
  const gameName = 'Test Game';

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    gameName,
    achievements: null,
    isLoading: false,
    error: null,
  };

  const mockAchievements: XboxDetailedAchievement[] = [
    { id: 'ach1', name: 'First One', description: 'Description for first.', isUnlocked: true, gamerscore: 50, iconUrl: 'icon1.jpg', unlockedTime: new Date().toISOString(), rarityPercent: 15.5 },
    { id: 'ach2', name: 'Second One', description: 'Description for second.', isUnlocked: false, gamerscore: 20, iconUrl: 'icon2.jpg' },
    { id: 'ach3', name: 'No Icon One', description: 'No icon here.', isUnlocked: true, gamerscore: 10, unlockedTime: new Date().toISOString() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing if isOpen is false', () => {
    render(<DetailedAchievementsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog with title and close button when open', () => {
    render(<DetailedAchievementsModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(`Achievements: ${gameName}`)).toBeInTheDocument();
    // expect(screen.getByText(`Detailed list of achievements for ${gameName}.`)).toBeInTheDocument(); // Description is commented out in modal
    expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<DetailedAchievementsModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('displays loading skeletons when isLoading is true', () => {
    render(<DetailedAchievementsModal {...defaultProps} isLoading={true} />);
    // Expect multiple skeletons. The modal renders 6.
    expect(screen.getAllByRole('generic', { name: '' }).filter(el => el.classList.contains('h-12') && el.classList.contains('w-12'))).toHaveLength(6); // Skeleton for icon
    expect(screen.getAllByRole('generic', { name: '' }).filter(el => el.classList.contains('h-4') && el.classList.contains('w-3/4'))).toHaveLength(6); // Skeleton for title
  });

  it('displays error message when error is provided', () => {
    const errorMessage = 'Failed to load achievements.';
    render(<DetailedAchievementsModal {...defaultProps} error={errorMessage} />);
    expect(screen.getByText('Error Loading Achievements')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
  });

  it('displays "No achievements found" when achievements array is empty and not loading/no error', () => {
    render(<DetailedAchievementsModal {...defaultProps} achievements={[]} />);
    expect(screen.getByText('No achievements found for this game.')).toBeInTheDocument();
  });

  it('displays "No achievements found" when achievements is null and not loading/no error', () => {
    render(<DetailedAchievementsModal {...defaultProps} achievements={null} />);
    expect(screen.getByText('No achievements found for this game.')).toBeInTheDocument();
  });

  it('renders list of achievements correctly', () => {
    render(<DetailedAchievementsModal {...defaultProps} achievements={mockAchievements} />);

    expect(screen.getByText(mockAchievements[0].name)).toBeInTheDocument();
    expect(screen.getByText(mockAchievements[0].description)).toBeInTheDocument();
    expect(screen.getByText(`${mockAchievements[0].gamerscore} GS`)).toBeInTheDocument();
    expect(screen.getByText(`${mockAchievements[0].rarityPercent?.toFixed(1)}% Rarity`)).toBeInTheDocument();
    expect(screen.getByText(`Unlocked: ${new Date(mockAchievements[0].unlockedTime!).toLocaleDateString()}`)).toBeInTheDocument();
    expect(screen.getAllByTestId('check-icon').length).toBeGreaterThanOrEqual(1); // For unlocked achievements

    expect(screen.getByText(mockAchievements[1].name)).toBeInTheDocument();
    expect(screen.getByText(mockAchievements[1].description)).toBeInTheDocument();
    expect(screen.getByText(`${mockAchievements[1].gamerscore} GS`)).toBeInTheDocument();

    // Check for images (presence of img tag with alt text)
    expect(screen.getByAltText(mockAchievements[0].name)).toHaveAttribute('src', 'icon1.jpg');
    expect(screen.getByAltText(mockAchievements[1].name)).toHaveAttribute('src', 'icon2.jpg');

    // Check for placeholder for achievement with no icon
    const ach3Name = mockAchievements[2].name;
    const ach3Element = screen.getByText(ach3Name).closest('li');
    expect(ach3Element).not.toContainHTML('<img'); // No img tag
    // Find placeholder icon within the context of the third achievement
    const listItemForAch3 = screen.getByText(ach3Name).closest('li');
    const placeholderIconInAch3 = listItemForAch3?.querySelector('[data-testid="image-off-icon"]');
    expect(placeholderIconInAch3).toBeInTheDocument();
  });

  it('handles achievements with missing optional fields gracefully', () => {
    const achievementWithoutOptional: XboxDetailedAchievement[] = [
      { id: 'ach4', name: 'Minimal Ach', description: 'Desc.', isUnlocked: false, gamerscore: 5 },
    ];
    render(<DetailedAchievementsModal {...defaultProps} achievements={achievementWithoutOptional} />);
    expect(screen.getByText('Minimal Ach')).toBeInTheDocument();
    expect(screen.getByText('Desc.')).toBeInTheDocument();
    expect(screen.getByText('5 GS')).toBeInTheDocument();
    // Check that rarity and unlocked time are not rendered if not present
    expect(screen.queryByText(/% Rarity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unlocked:/i)).not.toBeInTheDocument();
  });
});
