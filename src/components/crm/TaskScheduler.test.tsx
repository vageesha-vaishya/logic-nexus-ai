import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TaskScheduler, Task } from './TaskScheduler';

const tasks: Task[] = [
  {
    id: 'task-1',
    title: 'Call the client',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    priority: 'medium',
    assigned_to: { name: 'Jane Doe' },
  },
  {
    id: 'task-2',
    title: 'Send overdue invoice',
    due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'overdue',
    priority: 'high',
    assigned_to: { name: 'Jane Doe' },
  },
  {
    id: 'task-3',
    title: 'Archive old ticket',
    due_date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    priority: 'low',
    assigned_to: { name: 'Jane Doe' },
  },
];

describe('TaskScheduler', () => {
  it('every tab controls a rendered panel', () => {
    render(<TaskScheduler tasks={tasks} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);

    for (const tab of tabs) {
      const id = tab.getAttribute('aria-controls');
      expect(id && document.getElementById(id), tab.textContent ?? '').toBeTruthy();
    }
  });
});
