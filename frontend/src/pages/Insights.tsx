import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { getLLMInsights, createChatSession, sendChatMessage } from '../api';
import { ChatMessage as UIMessage, InsightResponse, LLMContext } from '../types';
import DOMPurify from 'dompurify';

const Insights: React.FC = () => {
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      text: "Hello! I'm your agricultural AI assistant. Ask me anything about your field data, or use the quick buttons below for instant insights.",
      isUser: false,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [contextModalOpen, setContextModalOpen] = useState<boolean>(false);
  const [contextValue, setContextValue] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load context and create chat session on component mount
  useEffect(() => {
    const savedContext = localStorage.getItem('llmContext');
    let contextText = '';
    
    if (savedContext) {
      try {
        const parsedContext: LLMContext = JSON.parse(savedContext);
        contextText = parsedContext.text;
        setContextValue(contextText);
      } catch (err) {
        console.error('Error parsing saved context:', err);
      }
    }
    
    // Create a chat session
    const initializeSession = async () => {
      try {
        const newSessionId = await createChatSession(contextText || undefined);
        setSessionId(newSessionId);
        console.log('Chat session created:', newSessionId);
      } catch (err) {
        console.error('Error creating chat session:', err);
      }
    };
    
    initializeSession();
  }, []);
  
  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading || !sessionId) return;
    
    // Add user message to chat
    const userMessage: UIMessage = {
      text: inputValue,
      isUser: true,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Process the message using the chat API
    await sendMessage(inputValue);
  };

  const saveContext = async () => {
    // Save context to localStorage
    const contextObj: LLMContext = {
      text: contextValue,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('llmContext', JSON.stringify(contextObj));
    
    // Create a new session with updated context if we already have one
    if (sessionId) {
      try {
        const newSessionId = await createChatSession(contextValue);
        setSessionId(newSessionId);
        
        // Add a message indicating context was updated
        const systemMessage: UIMessage = {
          text: "Context updated. I'll use this additional information to provide better insights.",
          isUser: false,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, systemMessage]);
      } catch (err) {
        console.error('Error updating chat session with new context:', err);
      }
    }
    
    setContextModalOpen(false);
  };

  const generateQuickInsight = async (promptType: 'small' | 'large') => {
    if (loading || !sessionId) return;
    
    const buttonText = promptType === 'small' ? 'Quick Advice' : 'Detailed Analysis';
    const prompt = promptType === 'small' ? 
      'Give me a quick analysis of my farm data and any urgent advice' : 
      'Provide a detailed analysis of my farm data with a comprehensive management plan';
    
    // Add system message indicating what's happening
    const systemMessage: UIMessage = {
      text: `Generating ${buttonText.toLowerCase()}...`,
      isUser: false,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, systemMessage]);
    
    // Use the chat session API to send the message
    await sendMessage(prompt);
  };
  
  const sendMessage = async (message: string) => {
    if (!sessionId) {
      console.error('No active session');
      return;
    }
    
    setLoading(true);
    
    // Add loading message
    const loadingMessage: UIMessage = {
      text: 'Analyzing your question...',
      isUser: false,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    try {
      // Use the chat session API to get a response
      const chatResponse = await sendChatMessage(
        sessionId,
        message,
        contextValue || undefined
      );
      
      // Replace loading message with response
      const aiMessage: UIMessage = {
        text: chatResponse.response,
        isUser: false,
        timestamp: chatResponse.timestamp
      };
      
      setMessages(prev => [...prev.slice(0, -1), aiMessage]);
    } catch (err) {
      console.error('Error fetching chat response:', err);
      
      // Replace loading message with error
      const errorMessage: UIMessage = {
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        isUser: false,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatMessageText = (text: string) => {
    // Only render markdown for AI messages (non-user messages)
    // For user messages, keep the original simple paragraph formatting
    const isMarkdown = !messages.find(m => m.text === text)?.isUser;
    
    if (isMarkdown) {
      // Create simple markdown-like formatting with basic regex
      // This is a simplified approach that doesn't require the marked library
      const formattedHtml = text
        // Bold: **text** to <strong>text</strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic: *text* to <em>text</em>
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Headers: # Header to <h1>Header</h1>
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        // Lists: - item to <li>item</li>
        .replace(/^- (.*?)$/gm, '<li>$1</li>')
        // Wrap lists in <ul></ul>
        .replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>')
        // Code blocks: `code` to <code>code</code>
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Links: [text](url) to <a href="url">text</a>
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        // Paragraphs: add <p></p> for text blocks
        .replace(/^([^<].*?)$/gm, '<p>$1</p>');
        
      const sanitizedHtml = DOMPurify.sanitize(formattedHtml);
      
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
          className="markdown-content"
        />
      );
    } else {
      return text.split('\n').map((paragraph, index) => (
        <p key={index} className={index === 0 ? 'mt-0' : 'mt-2'}>{paragraph}</p>
      ));
    }
  };

  return (
    <div className="container py-8 h-screen flex flex-col">
      <h1 className="text-3xl font-bold mb-6">AI Agricultural Assistant</h1>
      
      {/* Context Modal */}
      {contextModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Custom Context for LLM</h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Add additional context that will be included in all LLM queries.
              This information will be stored locally and used to enhance the AI's understanding.
            </p>
            <textarea
              value={contextValue}
              onChange={(e) => setContextValue(e.target.value)}
              className="w-full h-40 p-2 border rounded-md mb-4 dark:bg-gray-700 dark:border-gray-600"
              placeholder="Enter additional context for the AI (e.g., specific crop information, soil types, recent weather events, etc.)"
            />
            <div className="flex justify-end gap-2">
              <Button 
                onClick={() => setContextModalOpen(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={saveContext}>
                Save Context
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Chat Messages Area */}
        <Card className="p-6 mb-4 flex-grow overflow-y-auto">
          <div className="flex flex-col space-y-4">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.isUser 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  {formatMessageText(message.text)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </Card>
        
        {/* Quick Action Buttons */}
        <div className="mb-4 flex gap-2 flex-wrap">
          <Button 
            onClick={() => generateQuickInsight('small')}
            disabled={loading}
            variant="outline"
            className="flex-grow"
          >
            Quick Advice
          </Button>
          <Button 
            onClick={() => generateQuickInsight('large')}
            disabled={loading}
            variant="outline"
            className="flex-grow"
          >
            Detailed Analysis
          </Button>
          <Button
            onClick={() => setContextModalOpen(true)}
            variant="outline"
            className="ml-2"
          >
            Edit Context
          </Button>
        </div>
        
        {/* Input Form */}
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              placeholder="Ask about your agricultural data..."
              className="flex-grow p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            />
            <Button 
              type="submit" 
              disabled={loading || !inputValue.trim()}
            >
              Send
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Insights;