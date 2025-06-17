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
  });

  it('fetchXboxGames should populate xboxGames and call toast on successful API call', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: mockApiResponseData });
    const { result, waitForNextUpdate } = renderHook(() => useXbox(), { wrapper });

    // Use act to wrap async state updates
    await act(async () => {
      result.current.fetchXboxGames(mockXuid);
      // Wait for the hook to process the promise resolution and update state
      await waitForNextUpdate({ timeout: 200 }); // Added timeout for potentially slower CI
    });

    expect(result.current.isLoading).toBe(false);
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
});
