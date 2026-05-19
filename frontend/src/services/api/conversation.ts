import api from './axios';

// Type definitions
interface ConversationAPI {
  _activeTaskId: string | null;
  _activeConversationId: string | null;
  _activeStreamControllers: Map<string, AbortController>;
  getActivePlan: (conversationId: string) => Promise<any>;
  getPlans: (conversationId: string) => Promise<any[]>;
  updatePlanItem: (conversationId: string, planId: string, itemId: string, updates: any) => Promise<any>;
  _getBaseUrl: () => string;
  [key: string]: any; // Allow additional properties for extensibility
}

/**
 * Conversation API service
 * API functions for agent conversations
 */
const conversationAPI: ConversationAPI = {
  _activeTaskId: null,
  _activeConversationId: null,
  _activeStreamControllers: new Map(),
  
  /**
   * Fetch active plan for a conversation
   * @param {string} conversationId conversation ID
   * @returns {Promise<Object|null>} active plan, or null when absent
   */
  getActivePlan: async (conversationId: string) => {
    try {
      const response = await api.get(`/conversations/${conversationId}/plans/active`);
      // Backend now returns null instead of 404; return response data directly
      return response.data;
    } catch (error) {
      // Log error
      console.error('fetch active plan failed:', error);
      return null;
    }
  },

  /**
   * Fetch all plans for a conversation
   * @param {string} conversationId conversation ID
   * @returns {Promise<Array>} plan list
   */
  getPlans: async (conversationId) => {
    try {
      const response = await api.get(`/conversations/${conversationId}/plans`);
      return response.data || [];
    } catch (error) {
      console.error('fetch plan list failed:', error);
      throw error;
    }
  },

  /**
   * Update plan-item status
   * @param {string} conversationId conversation ID
   * @param {string} planId plan ID
   * @param {string} itemId plan item ID
   * @param {Object} updates updates
   * @returns {Promise<Object>} updated plan item
   */
  updatePlanItem: async (conversationId, planId, itemId, updates) => {
    try {
      const response = await api.put(
        `/conversations/${conversationId}/plans/${planId}/items/${itemId}`,
        updates
      );
      return response.data;
    } catch (error) {
      console.error('update plan item failed:', error);
      throw error;
    }
  },

  // Get API base URL from api instance or environment
  _getBaseUrl: () => {
    // Remove '/api' from imported api baseURL because endpoints already include it
    const apiBaseUrl = api.defaults.baseURL;
    if (apiBaseUrl) {
      // Remove trailing '/api' when present
      const baseUrlWithoutApi = apiBaseUrl.endsWith('/api')
        ? apiBaseUrl.substring(0, apiBaseUrl.length - 4)
        : apiBaseUrl;
      return baseUrlWithoutApi;
    }
    // Fall back to environment variable
    return process.env.REACT_APP_API_URL || '';
  },

  /**
   * Fetch all conversations for an action task
   * @param {string} taskId action task ID
   * @returns {Promise<Array>} conversation list
   */
  getConversations: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations`);
      return response.data.conversations || [];
    } catch (error) {
      console.error('fetch conversation list failed:', error);
      throw error;
    }
  },

  /**
   * Fetch specific conversation detail
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @returns {Promise<Object>} conversation detail
   */
  getConversationById: async (taskId, conversationId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('fetch conversation detail failed:', error);
      throw error;
    }
  },

  /**
   * Create subtask conversation
   * @param {string} taskId action task ID
   * @param {Object} data conversation data
   * @returns {Promise<Object>} created conversation info
   */
  createConversation: async (taskId, data) => {
    try {
      const response = await api.post(`/action-tasks/${taskId}/conversations`, data);
      return response.data;
    } catch (error) {
      console.error('create conversation failed:', error);
      throw error;
    }
  },

  /**
   * Fetch message history for specific conversation
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @returns {Promise<Array>} message history array
   */
  getConversationMessages: async (taskId, conversationId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages`);
      return response.data.messages || [];
    } catch (error) {
      console.error('fetch conversation message history failed:', error);
      throw error;
    }
  },

  /**
   * Send message to specific conversation (streaming only)
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @param {object} messageData message data object
   * @param {string} messageData.content message content
   * @param {string} [messageData.target_agent_id] target agent ID (optional)
   * @param {boolean} [stream=true] whether to use streaming response (must be true)
   * @param {function} onStreamCallback streaming response callback, shape: (content, meta) => {}
   * @returns {Promise<object>} send result
   */
  sendConversationMessage: async (taskId, conversationId, messageData, stream = true, onStreamCallback) => {
    try {
      console.log(`send conversation message: taskId=${taskId}, conversationId=${conversationId}, stream=${stream}`, messageData);

      // Streaming response mode only
      if (stream && onStreamCallback) {
        // Build API endpoint with stream=1 and unified base URL
        const baseUrl = conversationAPI._getBaseUrl();
        const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/messages?stream=1`;
        console.log('stream request endpoint:', endpoint);

        // Notify connection is starting
        onStreamCallback(null, { connectionStatus: 'connecting' });

        // Send request with fetch
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        });

        // Check response status
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error (${response.status}): ${errorText}`);
        }

        // Read response body as stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Notify connection established
        onStreamCallback(null, { connectionStatus: 'connected' });

        let responseObj = {};
        let buffer = '';

        // Read stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode binary data to text
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Split by line and handle complete SSE messages
          let lines = buffer.split('\n');

          // Keep last possibly-incomplete line in buffer
          buffer = lines.pop() || '';

          // Handle complete lines
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty and comment lines
            if (!line || line.startsWith(':')) {
              continue;
            }

            // Handle SSE line
            if (line.startsWith('data: ')) {
              const data = line.substring(6); // Remove "data: " prefix

              // Empty data may indicate stream end
              if (!data.trim()) {
                console.log('received empty data, may be stream end signal');
                continue;
              }

              // Check whether this is an HTML comment separator
              if (data.includes('<!-- LLM starts processing tool-call results -->') ||
                  data.includes('<!-- LLM finishes processing tool-call results -->')) {
                console.log('detected tool-call processing separator:', data);
                // Pass HTML comment directly as callback content for frontend separation display
                onStreamCallback(data, null);
                continue;
              }

              // Try parsing JSON
              try {
                const parsed = JSON.parse(data);
                console.log('parsed streaming message:', parsed);

                // Branch 1: content event with content field
                if (parsed.content !== undefined && !parsed.type && !parsed.connectionStatus) {
                  onStreamCallback(parsed.content, null);
                  continue;
                }

                // Branch 2: string type
                if (typeof parsed === 'string') {
                  onStreamCallback(parsed, null);
                  continue;
                }

                // Branch 3: event with connectionStatus field
                if (parsed.connectionStatus) {
                  onStreamCallback(null, parsed);
                  continue;
                }

                // Branch 4: event with type field (thinking/tool calls/notifications)
                if (parsed.type) {
                  // Extra handling for specific types
                  if (parsed.type === 'processingToolResults' && parsed.meta) {
                    console.log('processing tool-call results:', parsed.meta);
                    // Pass meta data to callback
                    onStreamCallback(null, {
                      type: 'processingToolResults',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // Handle tool-result status changes
                  if (parsed.type === 'toolResultsProcessing' && parsed.meta) {
                    console.log('tool-result processing status changed:', parsed.meta);
                    // Pass meta data to callback
                    onStreamCallback(null, {
                      type: 'toolResultsProcessing',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // Pass all other typed events
                  onStreamCallback(null, parsed);
                  continue;
                }

                // Branch 5: otherwise try passing as content
                console.log('unrecognized JSON shape; passing as content:', parsed);
                onStreamCallback(data, null);

              } catch (error) {
                // If JSON parsing fails, handle data as plain text content
                console.log('JSON parse failed; handling as plain text:', data);
                onStreamCallback(data, null);
              }
            }
          }
        }

        // Handle stream end
        console.log('stream read complete');
        return responseObj;
      }

      // Throw when streaming callback is not provided
      throw new Error('sendConversationMessage requires streaming mode; provide stream=true and onStreamCallback');
    } catch (error) {
      // Use warn instead of error for user-initiated aborts
      if (error.name === 'AbortError' || error.message.includes('user abort')) {
        console.warn('stream request aborted by user:', error);
      } else {
        console.error('send message to conversation failed:', error);
      }
      throw error; // Throw directly for caller handling
    }
  },

  /**
   * Fetch message history for specific task
   * @param {string} taskId task ID
   * @returns {Promise<Array>} message history array
   */
  getMessages: async (taskId) => {
    try {
      // Try fetching the task's first conversation
      try {
        const conversations = await conversationAPI.getConversations(taskId);
        if (conversations && conversations.length > 0) {
          // Use messages from first conversation
          const conversationMessages = await conversationAPI.getConversationMessages(taskId, conversations[0].id);
          return conversationMessages;
        }
      } catch (err) {
        console.warn('fetch conversation messages failed; trying task messages:', err);
      }

      // Fallback: fetch task messages directly (legacy API, deprecated in future)
      const response = await api.get(`/action-tasks/${taskId}/messages`);
      console.warn('Warning: task-level message API will be deprecated; migrate to conversation-based API');
      return response.data.messages || [];
    } catch (error) {
      console.error('fetch message history failed:', error);
      throw error;
    }
  },

  /**
   * Poll new messages
   * @param {string} taskId task ID
   * @param {string} [conversationId] conversation ID (optional)
   * @param {string} lastMessageId last message ID
   * @returns {Promise<Array>} new message array
   */
  pollNewMessages: async (taskId, conversationId, lastMessageId) => {
    try {
      // Prefer specified conversation ID
      if (conversationId) {
        const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages/new`, {
          params: { last_message_id: lastMessageId }
        });
        return response.data.messages || [];
      }

      // Otherwise try default conversation
      const conversations = await conversationAPI.getConversations(taskId);
      if (conversations && conversations.length > 0) {
        const response = await api.get(`/action-tasks/${taskId}/conversations/${conversations[0].id}/messages/new`, {
          params: { last_message_id: lastMessageId }
        });
        return response.data.messages || [];
      }

      // Fallback: use task messages API
      console.warn('Warning: task-level polling API will be deprecated; migrate to conversation-based API');
      const response = await api.get(`/action-tasks/${taskId}/messages/new`, {
        params: { last_message_id: lastMessageId }
      });
      return response.data.messages || [];
    } catch (error) {
      console.error('poll messages failed:', error);
      throw error;
    }
  },

  /**
   * Fetch conversation metadata
   * @param {string} taskId task ID
   * @returns {Promise<object>} conversation metadata
   */
  getConversationMetadata: async (taskId) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}`);
      return response.data;
    } catch (error) {
      console.error('fetch conversation metadata failed:', error);
      throw error;
    }
  },

  /**
   * Send message to conversation (streaming API version)
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @param {object} messageData message data
   * @param {function} onStreamCallback streaming callback, shape: (content, meta) => {}
   * @returns {Promise<object>} send result
   */
  sendConversationMessageStream: async (taskId, conversationId, messageData, onStreamCallback) => {
    // Generate unique controller key from send_target to avoid supervisor/task conversation conflicts
    const sendTarget = messageData.send_target || 'task';
    const controllerKey = `${conversationId}:${sendTarget}`;
    
    try {
      console.log(`stream send message: taskId=${taskId}, conversationId=${conversationId}, sendTarget=${sendTarget}`, messageData);

      // Record active conversation info for stream cancellation
      conversationAPI._activeTaskId = taskId;
      conversationAPI._activeConversationId = conversationId;

      // Cancel existing stream request for this conversation first
      const existingController = conversationAPI._activeStreamControllers.get(controllerKey);
      if (existingController) {
        console.log(`cancel previous stream request for this conversation (${sendTarget})`);
        try {
          existingController.abort();
        } catch (e) {
          console.error('failed to cancel previous stream request:', e);
        }
      }

      // Create new AbortController instance
      const controller = new AbortController();
      conversationAPI._activeStreamControllers.set(controllerKey, controller);

      // Build API endpoint with stream=1 and unified base URL
      const baseUrl = conversationAPI._getBaseUrl();
      const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/messages?stream=1`;
      console.log('stream request endpoint:', endpoint);

      // Notify connection is starting
      onStreamCallback(null, { connectionStatus: 'connecting' });

      // Send request with fetch
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
        signal: controller.signal // Use AbortController signal
      });

      // Check response status
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      // Read response body as stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Notify connection established
      onStreamCallback(null, { connectionStatus: 'connected' });

      let responseObj = {};
      let buffer = '';

      // Read stream
      while (true) {
        try {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode binary data to text
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Split by line and handle complete SSE messages
          let lines = buffer.split('\n');

          // Keep last possibly-incomplete line in buffer
          buffer = lines.pop() || '';

          // Handle complete lines
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty and comment lines
            if (!line || line.startsWith(':')) {
              continue;
            }

            // Handle SSE line
            if (line.startsWith('data: ')) {
              const data = line.substring(6); // Remove "data: " prefix

              // Empty data may indicate stream end
              if (!data.trim()) {
                console.log('received empty data, may be stream end signal');
                continue;
              }

              // No longer need to handle HTML comment separators
              // Frontend can identify tool-call/result-processing status by message type

              // Try parsing JSON
              try {
                const parsed = JSON.parse(data);
                console.log('parsed streaming message:', parsed);

                // Branch 1: content event with content field
                if (parsed.content !== undefined && !parsed.type && !parsed.connectionStatus) {
                  onStreamCallback(parsed.content, null);
                  continue;
                }

                // Branch 2: string type
                if (typeof parsed === 'string') {
                  onStreamCallback(parsed, null);
                  continue;
                }

                // Branch 3: event with connectionStatus field
                if (parsed.connectionStatus) {
                  onStreamCallback(null, parsed);
                  continue;
                }

                // Branch 4: event with type field (thinking/tool calls/notifications)
                if (parsed.type) {
                  // Extra handling for specific types
                  if (parsed.type === 'processingToolResults' && parsed.meta) {
                    console.log('processing tool-call results:', parsed.meta);
                    // Pass meta data to callback
                    onStreamCallback(null, {
                      type: 'processingToolResults',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // Handle tool-result status changes
                  if (parsed.type === 'toolResultsProcessing' && parsed.meta) {
                    console.log('tool-result processing status changed:', parsed.meta);
                    // Pass meta data to callback
                    onStreamCallback(null, {
                      type: 'toolResultsProcessing',
                      ...parsed.meta
                    });
                    continue;
                  }

                  // Pass all other typed events
                  onStreamCallback(null, parsed);
                  continue;
                }

                // Branch 5: otherwise try passing as content
                console.log('unrecognized JSON shape; passing as content:', parsed);
                onStreamCallback(data, null);

              } catch (error) {
                // If JSON parsing fails, handle data as plain text content
                console.log('JSON parse failed; handling as plain text:', data);
                onStreamCallback(data, null);
              }
            }
          }
        } catch (error) {
          // Check whether error was caused by abort signal
          if (error.name === 'AbortError') {
            console.log('stream request aborted');
            // Notify callback that stream was cancelled
            onStreamCallback(null, {
              connectionStatus: 'error',
              error: 'stream request aborted by user'
            });
            break;
          }

          // Other errors
          console.error('error while reading stream:', error);
          onStreamCallback(null, {
            connectionStatus: 'error',
            error: `error while reading stream: ${error.message}`
          });
          break;
        }
      }

      // Clear controller reference using controllerKey
      if (conversationAPI._activeStreamControllers.get(controllerKey) === controller) {
        conversationAPI._activeStreamControllers.delete(controllerKey);
      }

      // Handle stream end
      console.log('stream read complete');
      return responseObj;
    } catch (error) {
      // Check whether error was caused by abort signal
      if (error.name === 'AbortError') {
        console.log('stream request aborted');
        // Do not show error because this may be a normal interruption when switching conversations
      } else {
        console.error('send streaming message to conversation failed:', error);
        onStreamCallback(null, {
          connectionStatus: 'error',
          error: error.message
        });
      }

      // Clear controller reference using controllerKey
      conversationAPI._activeStreamControllers.delete(controllerKey);

      throw error; // Throw directly for caller handling
    }
  },

  /**
   * Cancel current streaming response
   * @param {string} [agentId] agent ID; if provided, only cancel that agent's streaming task
   * @returns {Promise<boolean>} whether cancellation succeeded
   */
  cancelStreamingResponse: async (agentId) => {
    return new Promise((resolve) => {
      try {
        // Store current active conversation info
        const activeTaskId = conversationAPI._activeTaskId;
        const activeConversationId = conversationAPI._activeConversationId;

        // If canceling only a specific agent, do not abort entire SSE connection
        // Abort connection only when canceling entire conversation
        if (!agentId && activeConversationId) {
          const controller = conversationAPI._activeStreamControllers.get(activeConversationId);
          if (controller) {
            console.log('cancel entire conversation; abort frontend stream request');
            try {
              controller.abort();
              conversationAPI._activeStreamControllers.delete(activeConversationId);
            } catch (e) {
              console.error('failed to abort frontend stream request:', e);
            }
          }
        } else if (agentId) {
          console.log(`cancel specific agent ${agentId}; keep SSE connection for subsequent agent info`);
        }

        // Call backend API to cancel streaming output if active conversation exists
        if (activeTaskId && activeConversationId) {
          // Prepare request data
          const requestData = agentId ? { agent_id: agentId } : {};

          // Call backend API to cancel streaming output
          api.post(`/action-tasks/${activeTaskId}/conversations/${activeConversationId}/cancel-stream`, requestData)
            .then(response => {
              console.log('backend cancel stream result:', response.data);
              // Treat cancellation as success regardless of backend response to avoid stuck frontend
              resolve(true);
            })
            .catch(error => {
              console.error('backend cancel stream error:', error);
              // Treat cancellation as success even if API call fails
              resolve(true);
            });
        } else {
          console.log('no active conversation info; cannot cancel streaming output');
          // Return success even with no active conversation to avoid stuck frontend
          resolve(true);
        }
      } catch (error) {
        console.error('cancel streaming response failed:', error);
        // Return success even on exception to avoid stuck frontend
        resolve(true);
      }
    });
  },

  /**
   * Start auto discussion (streaming API version)
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @param {object} discussionOptions discussion options
   * @param {number} discussionOptions.rounds discussion rounds
   * @param {string} [discussionOptions.topic] discussion topic
   * @param {boolean} [discussionOptions.summarize] whether to summarize
   * @param {number} [discussionOptions.summarizerAgentId] summarizer agent ID (optional; defaults to first agent)
   * @param {function} onStreamCallback streaming response callback, shape: (content, meta) => {}
   * @returns {Promise<object>} discussion result
   */
  startAutoDiscussion: async (taskId, conversationId, discussionOptions, onStreamCallback) => {
    try {
      console.log(`start auto discussion: taskId=${taskId}, conversationId=${conversationId}`, discussionOptions);

      // Record active conversation info for stream cancellation
      conversationAPI._activeTaskId = taskId;
      conversationAPI._activeConversationId = conversationId;

      // Cancel existing stream request for this conversation first
      const existingController = conversationAPI._activeStreamControllers.get(conversationId);
      if (existingController) {
        console.log('cancel previous stream request for this conversation');
        try {
          existingController.abort();
        } catch (e) {
          console.error('failed to cancel previous stream request:', e);
        }
      }

      // Create new AbortController instance
      const controller = new AbortController();
      conversationAPI._activeStreamControllers.set(conversationId, controller);

      // Build API endpoint with stream=1 and unified base URL
      const baseUrl = conversationAPI._getBaseUrl();
      const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/auto-discussion?stream=1`;
      console.log('auto-discussion stream endpoint:', endpoint);

      // Notify connection is starting
      onStreamCallback(null, { connectionStatus: 'connecting' });

      // Send request with fetch
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discussionOptions),
        signal: controller.signal // Use AbortController signal
      });

      // Check response status
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      // Read response body as stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Notify connection established
      onStreamCallback(null, { connectionStatus: 'connected' });

      let responseObj = {};
      let buffer = '';

      // Read stream
      while (true) {
        try {
          // Read next chunk
          const { done, value } = await reader.read();

          // Exit loop when stream ends
          if (done) {
            console.log('auto-discussion stream ended');
            break;
          }

          // Decode binary data to text
          const chunk = decoder.decode(value, { stream: true });
          console.log('received auto-discussion chunk:', chunk.length, 'bytes');

          // Append to buffer
          buffer += chunk;

          // Split buffer by line
          const lines = buffer.split('\n');

          // If there is only one incomplete line, continue reading
          if (lines.length === 1 && !buffer.endsWith('\n')) {
            continue;
          }

          // Keep last incomplete line for next append
          buffer = lines.pop() || '';

          // Handle complete lines
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty and comment lines
            if (!line || line.startsWith(':')) {
              continue;
            }

            console.log('auto-discussion process line:', line.substring(0, 50) + (line.length > 50 ? '...' : ''));

            // Handle SSE line
            if (line.startsWith('data: ')) {
              const data = line.substring(6); // Remove "data: " prefix

              // Empty data may indicate stream end
              if (!data.trim()) {
                console.log('received empty data, may be stream end signal');
                continue;
              }

              // No longer need to handle HTML comment separators
              // Frontend can identify tool-call/result-processing status by message type

              // Try parsing JSON
              try {
                const parsed = JSON.parse(data);
                console.log('auto-discussion JSON parse result:', typeof parsed, parsed ?
                  (typeof parsed === 'object' ? Object.keys(parsed) : 'non-object') : 'empty value');

                // Special handling for cases where done status may not be processed correctly
                if (parsed.connectionStatus === 'done') {
                  console.log('auto-discussion done status signal received:', parsed);

                  // Ensure callback receives done status
                  onStreamCallback(null, {
                    connectionStatus: 'done',
                    message: parsed.message || 'Auto discussion completed',
                    ...(parsed) // Keep original fields
                  });

                  // Clear active controller
                  console.log('auto discussion completed normally; clearing active controller');
                  conversationAPI._activeStreamControllers.delete(conversationId);

                  // Skip following processing
                  continue;
                }

                // Special handling for connectionStatus field, possibly on root object
                if (parsed.connectionStatus) {
                  console.log('auto discussion received direct connection status:', parsed.connectionStatus);
                  onStreamCallback(null, parsed); // Pass whole object as meta

                  // Clear controller reference if this is a done event
                  if (parsed.connectionStatus === 'done' || parsed.connectionStatus === 'error') {
                    console.log(`auto discussion ${parsed.connectionStatus === 'done' ? 'completed normally' : 'ended with error'}`);
                    conversationAPI._activeStreamControllers.delete(conversationId);
                  }
                }
                // Process content and meta normally
                else {
                  // Call callback with content and meta
                  onStreamCallback(parsed.content, parsed.meta);

                  // Handle connection status
                  if (parsed.meta && parsed.meta.connectionStatus) {
                    console.log('auto discussion received connection status:', parsed.meta.connectionStatus);
                    // Clear controller reference if this is a done event
                    if (parsed.meta.connectionStatus === 'done' || parsed.meta.connectionStatus === 'error') {
                      console.log(`auto discussion ${parsed.meta.connectionStatus === 'done' ? 'completed normally' : 'ended with error'}`);
                      conversationAPI._activeStreamControllers.delete(conversationId);
                    }
                  }
                }

              } catch (error) {
                // If JSON parsing fails, handle data as plain text content
                console.error('auto-discussion JSON parse failed:', error, 'raw data:', data);
                onStreamCallback(data, null);
              }
            }
          }
        } catch (error) {
          // Check whether error was caused by abort signal
          if (error.name === 'AbortError') {
            console.log('auto-discussion stream request aborted');
            // Do not show error because this may be a normal interruption when switching conversations
            break;
          }

          // Other errors
          console.error('auto-discussion stream read failed:', error);
          onStreamCallback(null, {
            connectionStatus: 'error',
            error: `error while reading stream: ${error.message}`
          });
          break;
        }
      }

      // Clear controller reference
      if (conversationAPI._activeStreamControllers.get(conversationId) === controller) {
        conversationAPI._activeStreamControllers.delete(conversationId);
      }

      // Handle stream end
      console.log('auto-discussion stream read complete');
      return responseObj;
    } catch (error) {
      // Check whether error was caused by abort signal
      if (error.name === 'AbortError') {
        console.log('auto-discussion stream request aborted');
        // Do not show error because this may be a normal interruption when switching conversations
      } else {
        console.error('auto-discussion stream request failed:', error);
        onStreamCallback(null, {
          connectionStatus: 'error',
          error: error.message
        });
      }

      // Clear controller reference
      conversationAPI._activeStreamControllers.delete(conversationId);

      throw error; // Throw directly for caller handling
    }
  },

  /**
   * Fetch all autonomous-task records for action task
   * @param {string} taskId action task ID
   * @returns {Promise<object>} autonomous-task record list
   */
  getActionTaskAutonomousTasks: async (taskId) => {
    try {
      console.log(`fetch action-task autonomous records: taskId=${taskId}`);
      const response = await api.get(`/action-tasks/${taskId}/autonomous-tasks`);
      console.log('fetch action-task autonomous records succeeded:', response.data);
      return response.data;
    } catch (error) {
      console.error('fetch action-task autonomous records failed:', error);
      throw error;
    }
  },

  /**
   * Fetch conversation autonomous records (compatibility)
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @returns {Promise<object>} autonomous-task record list
   */
  getAutonomousTasks: async (taskId, conversationId) => {
    try {
      console.log(`fetch autonomous records: taskId=${taskId}, conversationId=${conversationId}`);
      const response = await api.get(`/action-tasks/${taskId}/conversations/${conversationId}/autonomous-tasks`);
      console.log('fetch autonomous records succeeded:', response.data);
      return response.data;
    } catch (error) {
      console.error('fetch autonomous records failed:', error);
      throw error;
    }
  },

  /**
   * Stop autonomous task
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @param {string} autonomousTaskId autonomous task ID
   * @returns {Promise<object>} stop result
   */
  stopAutonomousTask: async (taskId, conversationId, autonomousTaskId) => {
    try {
      console.log(`Stop autonomous task: task ID=${taskId}, conversation ID=${conversationId}, autonomous task ID=${autonomousTaskId}`);
      const response = await api.post(`/action-tasks/${taskId}/conversations/${conversationId}/autonomous-tasks/${autonomousTaskId}/stop`);
      console.log('stop autonomous task succeeded:', response.data);
      return response.data;
    } catch (error) {
      console.error('stop autonomous task failed:', error);
      throw error;
    }
  },

  /**
   * Start variable-trigger conversation
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @param {object} config variable trigger config
   * @param {string} config.topic discussion topic
   * @param {Array} config.triggerConditions trigger condition array
   * @param {string} config.conditionLogic condition logic ('and' | 'or')
   * @param {number} config.checkInterval check interval (seconds)
   * @param {number} config.maxTriggers max trigger count
   * @param {number} config.maxRuntime max runtime (minutes)
   * @param {function} onStreamCallback streaming response callback
   * @returns {Promise<object>} start result
   */
  startVariableTriggerConversation: async (taskId, conversationId, config, onStreamCallback) => {
    try {
      console.log(`Start variable-trigger conversation: task ID=${taskId}, conversation ID=${conversationId}`, config);

      // Build variable-trigger options reusing startAutoDiscussion shape
      const variableTriggerOptions = {
        isVariableTrigger: true,
        topic: config.topic || 'Respond to variable changes based on each role and knowledge',
        triggerConditions: config.triggerConditions || [],
        triggerConditionLogic: config.conditionLogic || 'or',
        checkInterval: config.checkInterval || 5,
        maxTriggerExecutions: config.maxTriggers || 0,
        totalTimeLimit: config.maxRuntime || 0,
        enablePlanning: config.enable_planning || false,
        plannerAgentId: config.planner_agent_id || null
      };

      // Reuse existing startAutoDiscussion method for consistency
      return await conversationAPI.startAutoDiscussion(
        taskId,
        conversationId,
        variableTriggerOptions,
        onStreamCallback
      );

    } catch (error) {
      console.error('start variable-trigger conversation failed:', error);
      throw error;
    }
  },

  /**
   * Summarize conversation context (auto-summary)
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @returns {Promise<object>} summary result
   */
  summarizeContext: async (taskId: string, conversationId: string) => {
    try {
      console.log(`summarize conversation context: taskId=${taskId}, conversationId=${conversationId}`);
      const response = await api.post(`/action-tasks/${taskId}/conversations/${conversationId}/summarize-context`);
      console.log('summarize conversation context succeeded:', response.data);
      return response.data;
    } catch (error) {
      console.error('summarize conversation context failed:', error);
      throw error;
    }
  },

  /**
   * Start autonomous-scheduling conversation
   * @param {string} taskId action task ID
   * @param {string} conversationId conversation ID
   * @param {object} config autonomous scheduling config
   * @param {string} config.topic task topic
   * @param {string} config.plannerAgentId planner agent ID (optional)
   * @param {number} config.maxRounds max rounds
   * @param {number} config.timeoutMinutes timeout (minutes)
   * @param {function} onStreamCallback streaming response callback
   * @returns {Promise<object>} start result
   */
  startAutonomousScheduling: async (taskId, conversationId, config, onStreamCallback) => {
    try {
      console.log(`Start autonomous-scheduling conversation: task ID=${taskId}, conversation ID=${conversationId}`, config);

      // Build autonomous-scheduling options
      const autonomousSchedulingOptions = {
        topic: config.topic || 'Collaborate with autonomous scheduling based on each role and knowledge',
        plannerAgentId: config.plannerAgentId || null,
        enablePlanning: config.enablePlanning || false,
        maxRounds: config.maxRounds || 50,
        timeoutMinutes: config.timeoutMinutes || 60,
        stream: true  // Always use streaming mode
      };

      // Cancel existing stream request for this conversation first
      const existingController = conversationAPI._activeStreamControllers.get(conversationId);
      if (existingController) {
        console.log('cancel previous stream request for this conversation');
        try {
          existingController.abort();
        } catch (e) {
          console.error('failed to cancel previous stream request:', e);
        }
      }

      // Create new AbortController instance
      const controller = new AbortController();
      conversationAPI._activeStreamControllers.set(conversationId, controller);

      // Build API endpoint with stream=1 and unified base URL
      const baseUrl = conversationAPI._getBaseUrl();
      const endpoint = `${baseUrl}/api/action-tasks/${taskId}/conversations/${conversationId}/autonomous-scheduling`;
      console.log('autonomous-scheduling stream endpoint:', endpoint);

      // Notify connection is starting
      onStreamCallback(null, { connectionStatus: 'connecting' });

      // Send request with fetch
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(autonomousSchedulingOptions),
        signal: controller.signal // Use AbortController signal
      });

      // Check response status
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      // Notify connection established
      onStreamCallback(null, { connectionStatus: 'connected' });

      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseObj = { status: 'success' };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('autonomous-scheduling stream read complete');
            break;
          }

          // Decode data
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '') continue;

            // Handle SSE-formatted data
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix

              if (data === '[DONE]') {
                console.log('autonomous-scheduling stream end marker');
                onStreamCallback(null, { connectionStatus: 'done' });
                // Clear active controller reference to prevent later abnormal state
                if (conversationAPI._activeStreamControllers.get(conversationId) === controller) {
                  conversationAPI._activeStreamControllers.delete(conversationId);
                }
                continue;
              }

              try {
                const parsedData = JSON.parse(data);
                console.log('autonomous-scheduling parsed data:', parsedData);

                // Call callback to process data
                if (parsedData.content !== undefined || parsedData.meta) {
                  onStreamCallback(parsedData.content, parsedData.meta);
                } else {
                  onStreamCallback(null, parsedData);
                }

              } catch (error) {
                // If JSON parsing fails, handle data as plain text content
                console.log('JSON parse failed; handling as plain text:', data);
                onStreamCallback(data, null);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Handle stream end
      console.log('autonomous-scheduling stream read complete');
      return responseObj;

    } catch (error) {
      console.error('start autonomous-scheduling conversation failed:', error);
      throw error;
    }
  },


};

export default conversationAPI;