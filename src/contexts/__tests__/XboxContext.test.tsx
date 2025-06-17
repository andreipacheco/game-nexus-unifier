import { renderHook, act } from '@testing-library/react-hooks';
import axios from 'axios';
import { XboxProvider, useXbox } from '../XboxContext';
import { ToastProvider } from '@/components/ui/toast'; // Assuming toast is used
import { toast } from '@/components/ui/use-toast'; // Actual toast function

jest.mock('axios');
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;

// Wrapper component to provide necessary context (ToastProvider for toasts called in context)
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <XboxProvider>{children}</XboxProvider>
  </ToastProvider>
);

describe('XboxContext', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mock calls before each test
  });

  const mockXuid = 'test-xuid-12345';
  const mockApiResponseData = [
    { _id: '1', xuid: mockXuid, titleId: '123', name: 'Halo: Master Chief Collection', displayImage: 'halo.jpg', achievements: { currentAchievements: 100, totalAchievements: 200, currentGamerscore: 1000, totalGamerscore: 2000 } },
    { _id: '2', xuid: mockXuid, titleId: '456', name: 'Sea of Thieves', displayImage: 'seaofthieves.jpg', achievements: { currentAchievements: 50, totalAchievements: 150, currentGamerscore: 500, totalGamerscore: 1500 } },
  ];

  it('should initialize with default values (empty games, no loading, no error)', () => {
    const { result } = renderHook(() => useXbox(), { wrapper });
    expect(result.current.xboxGames).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentXuid).toBeNull();
    expect(result.current.detailedAchievements).toEqual({});
    expect(result.current.isLoadingDetailedAchievements).toEqual({});
    expect(result.current.errorDetailedAchievements).toEqual({});
  });

  it('fetchXboxGames should populate games and set currentXuid on successful API call', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: mockApiResponseData });
    const { result, waitForNextUpdate } = renderHook(() => useXbox(), { wrapper });

    // Use act to wrap async state updates
    await act(async () => {
      result.current.fetchXboxGames(mockXuid);
      await waitForNextUpdate({ timeout: 200 });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.currentXuid).toBe(mockXuid); // Check if currentXuid is set
    // Games should be sorted by name as per context implementation
    const sortedMockData = [...mockApiResponseData].sort((a, b) => a.name.localeCompare(b.name));
    expect(result.current.xboxGames).toEqual(sortedMockData);
    expect(result.current.error).toBeNull();
    expect(mockAxios.get).toHaveBeenCalledWith(`/api/xbox/user/${mockXuid}/games`);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Xbox games loaded",
      description: `Successfully fetched ${sortedMockData.length} Xbox games.`,
    }));
  });

  it('fetchXboxGames should set error state and call toast on API failure', async () => {
    const errorMessage = 'Failed to fetch Xbox games.'; // This is the generic message from context
    const actualApiErrorMessage = 'API is down';
    mockAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: actualApiErrorMessage }, status: 500 },
      message: 'Request failed' // Default Axios message
    });
    const { result, waitForNextUpdate } = renderHook(() => useXbox(), { wrapper });

    await act(async () => {
      result.current.fetchXboxGames(mockXuid);
      await waitForNextUpdate({ timeout: 200 });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.xboxGames).toEqual([]);
    expect(result.current.error).toBe(actualApiErrorMessage); // Error from response.data.error
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Error fetching Xbox games",
      description: actualApiErrorMessage,
      variant: "destructive",
    }));
  });

  it('fetchXboxGames should set specific error message for 404 from API', async () => {
    const errorMessage = "No Xbox games found or profile is private.";
    mockAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: "Profile not found" }, status: 404 },
      message: 'Request failed'
    });
    const { result, waitForNextUpdate } = renderHook(() => useXbox(), { wrapper });

    await act(async () => {
      result.current.fetchXboxGames(mockXuid);
      await waitForNextUpdate({ timeout: 200 });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.xboxGames).toEqual([]);
    expect(result.current.error).toBe(errorMessage); // Specific message for 404
     expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Error fetching Xbox games",
      description: errorMessage,
      variant: "destructive",
    }));
  });

  it('fetchXboxGames should set error and not call API if no xuid is provided', async () => {
    const { result } = renderHook(() => useXbox(), { wrapper });

    await act(async () => {
      // No await waitForNextUpdate needed if no async operations are expected
      result.current.fetchXboxGames('');
    });

    expect(result.current.error).toBe("Xbox User ID (XUID) is not available.");
    expect(result.current.xboxGames).toEqual([]);
    expect(mockAxios.get).not.toHaveBeenCalled();
    // No toast should be called here as it's a pre-flight validation
    expect(toast).not.toHaveBeenCalled();
  });

  describe('fetchDetailedXboxAchievements', () => {
    const mockTitleId = 'gameTitle123';
    // Simulate raw data from your backend (which gets it from xbl.io)
    const rawApiDetailedAchievements = [
      {
        id: 'ach1_id', // Assuming 'id' is present from xbl.io
        name: 'Master Chef',
        description: 'Complete all missions on Legendary.',
        progressState: 'Achieved',
        rewards: [{type: 'Gamerscore', value: 100}],
        mediaAssets: [{type: 'Icon', url: 'icon_url_ach1.jpg'}],
        rarity: {currentProgress: 10.5}, // xbl.io v1 example
        progression: {timeUnlocked: '2023-01-15T12:00:00Z'}
      },
      {
        name: 'Speed Runner', // Testing fallback id: ach.name
        description: 'Finish the campaign in under 3 hours.',
        progressState: 'NotAchieved',
        rewards: [{type: 'Gamerscore', value: 50}],
        // No mediaAssets, rarity, or progression for this one to test defaults
      }
    ];

    // Expected structure after mapping logic in fetchDetailedXboxAchievements
    const mappedDetailedAchievements: XboxDetailedAchievement[] = [
      {
        id: 'ach1_id',
        name: 'Master Chef',
        description: 'Complete all missions on Legendary.',
        isUnlocked: true,
        gamerscore: 100,
        iconUrl: 'icon_url_ach1.jpg',
        rarityPercent: 10.5,
        unlockedTime: '2023-01-15T12:00:00Z',
        progressState: 'Achieved',
        rewards: [{type: 'Gamerscore', value: 100}],
        mediaAssets: [{type: 'Icon', url: 'icon_url_ach1.jpg'}],
        rarity: {currentProgress: 10.5},
        howToUnlock: undefined,
      },
      {
        id: 'Speed Runner',
        name: 'Speed Runner',
        description: 'Finish the campaign in under 3 hours.',
        isUnlocked: false,
        gamerscore: 50,
        iconUrl: undefined,
        rarityPercent: undefined,
        unlockedTime: undefined,
        progressState: 'NotAchieved',
        rewards: [{type: 'Gamerscore', value: 50}],
        mediaAssets: undefined,
        rarity: undefined,
        howToUnlock: undefined,
      },
    ];

    it('should populate detailedAchievements for a titleId on success and map data correctly', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: rawApiDetailedAchievements });
      const { result, waitForNextUpdate } = renderHook(() => useXbox(), { wrapper });

      await act(async () => {
        result.current.fetchDetailedXboxAchievements(mockXuid, mockTitleId);
        // One update for isLoading true, another for data and isLoading false
        await waitForNextUpdate({ timeout: 200 });
        await waitForNextUpdate({ timeout: 200 });
      });

      expect(result.current.isLoadingDetailedAchievements[mockTitleId]).toBe(false);
      expect(result.current.detailedAchievements[mockTitleId]).toEqual(mappedDetailedAchievements);
      expect(result.current.errorDetailedAchievements[mockTitleId]).toBeNull();
      expect(mockAxios.get).toHaveBeenCalledWith(`/api/xbox/user/${mockXuid}/game/${mockTitleId}/achievements`);
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: `Achievements for ${mockTitleId}`,
      }));
    });

    it('should set error for a titleId on API failure when fetching detailed achievements', async () => {
      const apiErrorMessage = "Detailed achievements API is down";
      mockAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { error: apiErrorMessage }, status: 503 }
      });
      const { result, waitForNextUpdate } = renderHook(() => useXbox(), { wrapper });

      await act(async () => {
        result.current.fetchDetailedXboxAchievements(mockXuid, mockTitleId);
        await waitForNextUpdate({ timeout: 200 });
        await waitForNextUpdate({ timeout: 200 });
      });

      expect(result.current.isLoadingDetailedAchievements[mockTitleId]).toBe(false);
      expect(result.current.detailedAchievements[mockTitleId]).toBeUndefined();
      expect(result.current.errorDetailedAchievements[mockTitleId]).toBe(apiErrorMessage);
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: "Error fetching detailed achievements",
        description: apiErrorMessage,
        variant: "destructive",
      }));
    });

    it('should return null and set error if XUID is missing for detailed achievements', async () => {
      const { result } = renderHook(() => useXbox(), { wrapper });
      let fetchResult: XboxDetailedAchievement[] | null = []; // Initialize to non-null

      await act(async () => {
        fetchResult = await result.current.fetchDetailedXboxAchievements('', mockTitleId);
      });

      expect(fetchResult).toBeNull();
      expect(result.current.errorDetailedAchievements[mockTitleId]).toBe("XUID and Title ID are required to fetch detailed achievements.");
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('should return null and set error if titleId is missing for detailed achievements', async () => {
      const { result } = renderHook(() => useXbox(), { wrapper });
      let fetchResult: XboxDetailedAchievement[] | null = [];

      await act(async () => {
        fetchResult = await result.current.fetchDetailedXboxAchievements(mockXuid, '');
      });

      expect(fetchResult).toBeNull();
      expect(result.current.errorDetailedAchievements['']).toBe("XUID and Title ID are required to fetch detailed achievements.");
      expect(mockAxios.get).not.toHaveBeenCalled();
    });
  });
});
