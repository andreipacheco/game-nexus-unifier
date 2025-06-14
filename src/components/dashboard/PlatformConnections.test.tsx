import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlatformConnections } from './PlatformConnections'; // Adjust path as necessary
import fetchMock from 'jest-fetch-mock';

// Mock lucide-react icons used in the component
jest.mock('lucide-react', () => {
  const original = jest.requireActual('lucide-react');
  return {
    ...original,
    Plug: () => <svg data-testid="plug-icon" />,
    CheckCircle: () => <svg data-testid="check-icon" />,
    XCircle: () => <svg data-testid="x-icon" />,
    ExternalLink: () => <svg data-testid="link-icon" />,
    Settings: () => <svg data-testid="settings-icon" />,
  };
});


describe('PlatformConnections Component', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('should allow connecting to Steam and display user info on success', async () => {
    const mockSteamUserData = {
      personaName: 'TestSteamUser',
      avatarFull: 'test-avatar.jpg',
      profileUrl: 'http://steamcommunity.com/id/teststeamuser',
    };
    fetchMock.mockResponseOnce(JSON.stringify(mockSteamUserData));

    render(<PlatformConnections />);

    // Find the Steam platform card. The text "Steam" should be present.
    const steamCard = (await screen.findAllByText('Steam'))
        .map(el => el.closest('div.relative')) // Assuming Card is relative, find parent card
        .find(card => card !== null && card !== undefined);

    if (!steamCard) throw new Error("Steam platform card not found");

    // Find the "Connect" or "Reconfigure" button for Steam.
    // The component shows "Connect" if not connected, "Reconfigure" if connected.
    // Initial state from platforms array has Steam as `connected: false` in the test component's context.
    // The button is inside a DialogTrigger.
    const connectButton = Array.from(steamCard.querySelectorAll('button')).find(btn => btn.textContent?.includes('Connect') || btn.textContent?.includes('Reconfigure'));
    if (!connectButton) throw new Error("Steam connect/reconfigure button not found");

    fireEvent.click(connectButton); // This opens the dialog

    // Wait for the dialog to appear and find the Steam ID input field
    // The input field's label is "Steam ID"
    const steamIdInput = await screen.findByLabelText('Steam ID') as HTMLInputElement;
    fireEvent.change(steamIdInput, { target: { value: 'teststeamid123' } });
    expect(steamIdInput.value).toBe('teststeamid123');

    // Find and click the "Save & Connect" button in the dialog
    const saveButton = await screen.findByText('Save & Connect');
    fireEvent.click(saveButton);

    // Wait for API call and UI update
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/steam/user/teststeamid123');
    });

    // The dialog closes on successful connection because `setSelectedPlatform(null)` is called.
    // Therefore, we should not try to find elements within the dialog after it's expected to close.
    // We will only check the main card's state.

    // Check if the Steam card itself updated to "Connected"
    // The component logic updates `platformsState` which should lead to a re-render.
    // The dialog might close automatically after success (setSelectedPlatform(null)), so we check the main card state.
    await waitFor(() => {
      // Re-query the steamCard to get its updated state if dialog closes and card re-renders.
      // For simplicity, we assume steamCard reference is still valid or query again if needed.
      // Check for the "Connected" badge text within the specific Steam card.
      expect(within(steamCard).getByText("Connected")).toBeInTheDocument();
      // Check for the CheckCircle icon as another indicator
      expect(within(steamCard).getByTestId("check-icon")).toBeInTheDocument();
    });
  });

  it('should display an error message if Steam connection fails', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Invalid Steam ID' }), { status: 500 });

    render(<PlatformConnections />);

    const steamCard = (await screen.findAllByText('Steam'))
        .map(el => el.closest('div.relative'))
        .find(card => card !== null && card !== undefined);
    if (!steamCard) throw new Error("Steam platform card not found");

    const connectButton = Array.from(steamCard.querySelectorAll('button')).find(btn => btn.textContent?.includes('Connect'));
    if (!connectButton) throw new Error("Steam connect button not found");
    fireEvent.click(connectButton);

    const steamIdInput = await screen.findByLabelText('Steam ID') as HTMLInputElement;
    fireEvent.change(steamIdInput, { target: { value: 'invalidsteamid' } });

    const saveButton = await screen.findByText('Save & Connect');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/steam/user/invalidsteamid');
    });

    // Check for error message display (e.g., the content of steamConnectError)
    // The error is displayed inside the dialog.
    await waitFor(async () => {
      const dialogContent = (await screen.findByRole('dialog', { name: /Connect Steam/i })).closest('[role="dialog"]');
      if (!dialogContent) throw new Error("Dialog not found for error assertion");
      expect(within(dialogContent).getByText('Invalid Steam ID')).toBeInTheDocument();
    });

    // Check that the Steam card still shows "Not Connected"
    await waitFor(() => {
      // Re-query the steamCard to get its updated state.
      expect(within(steamCard).getByText("Not Connected")).toBeInTheDocument();
      // Check for the XCircle icon as another indicator
      expect(within(steamCard).getByTestId("x-icon")).toBeInTheDocument();
    });
  });
});
