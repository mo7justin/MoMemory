import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { openUpdateMemoryDialog, closeUpdateMemoryDialog } from '@/store/uiSlice';

export const useUI = () => {
  const dispatch = useDispatch<AppDispatch>();
  const updateMemoryDialog = useSelector((state: RootState) => state.ui.dialogs.updateMemory);

  const handleOpenUpdateMemoryDialog = (memoryId: string, memoryContent: string) => {
    console.log("Opening update memory dialog", { memoryId, memoryContent });
    dispatch(openUpdateMemoryDialog({ memoryId, memoryContent }));
  };

  const handleCloseUpdateMemoryDialog = () => {
    console.log("Closing update memory dialog");
    dispatch(closeUpdateMemoryDialog());
  };

  return {
    updateMemoryDialog,
    handleOpenUpdateMemoryDialog,
    handleCloseUpdateMemoryDialog,
  };
};