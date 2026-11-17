import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'dockview/dist/styles/dockview.css';
import './styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('root');
if (root === null) throw new Error('Root element not found');
createRoot(root).render(<MantineProvider defaultColorScheme="dark"><Notifications /><App /></MantineProvider>);
