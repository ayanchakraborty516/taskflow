import React, { createContext, useContext, useState, useCallback } from 'react';

const TaskDrawerContext = createContext(null);

export const TaskDrawerProvider = ({ children }) => {
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [onUpdateCallback, setOnUpdateCallback] = useState(null);

  const openDrawer = useCallback((taskId, onUpdate) => {
    setActiveTaskId(taskId);
    if (onUpdate) {
      setOnUpdateCallback(() => onUpdate);
    } else {
      setOnUpdateCallback(null);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveTaskId(null);
    setOnUpdateCallback(null);
  }, []);

  const triggerUpdate = useCallback(() => {
    if (onUpdateCallback) {
      onUpdateCallback();
    }
  }, [onUpdateCallback]);

  return (
    <TaskDrawerContext.Provider
      value={{
        activeTaskId,
        openDrawer,
        closeDrawer,
        triggerUpdate,
      }}
    >
      {children}
    </TaskDrawerContext.Provider>
  );
};

export const useTaskDrawer = () => {
  const context = useContext(TaskDrawerContext);
  if (!context) {
    throw new Error('useTaskDrawer must be used within a TaskDrawerProvider');
  }
  return context;
};
