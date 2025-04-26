import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { getLLMInsights } from '../api';
import { ChatMessage, InsightResponse } from '../types';

const Insights: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      text: "Hello! I'm your agricultural AI assistant. Ask me anything about your field data, or use the quick buttons below for instant insights.",
      isUser: false,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [includeWeather, setIncludeWeather] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      text: inputValue,
      isUser: true,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Process the message
    await generateCustomInsight(inputValue);
  };

  const generateQuickInsight = async (promptType: 'small' | 'large') => {
    if (loading) return;
    
    const buttonText = promptType === 'small' ? 'Quick Advice' : 'Detailed Analysis';
    
    // Add system message indicating what's happening
    const systemMessage: ChatMessage = {
      text: `Generating ${buttonText.toLowerCase()}...`,
      isUser: false,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, systemMessage]);
    setLoading(true);
    
    try {
      const response = await getLLMInsights(
        promptType,
        10, // n_readings
        undefined, // custom_prompt
        includeWeather
      );
      
      // Add AI response to chat
      const aiMessage: ChatMessage = {
        text: response.insights,
        isUser: false,
        timestamp: new Date().toISOString()
      };
      
      // Replace the "generating" message with the actual response
      setMessages(prev => [...prev.slice(0, -1), aiMessage]);
    } catch (err) {
      console.error('Error fetching insights:', err);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        text: 'Sorry, I encountered an error generating insights. Please try again.',
        isUser: false,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setLoading(false);
    }
  };
  
  const generateCustomInsight = async (customPrompt: string) => {
    setLoading(true);
    
    // Add loading message
    const loadingMessage: ChatMessage = {
      text: 'Analyzing your question...',
      isUser: false,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    try {
      const response = await getLLMInsights(
        'custom',
        10, // n_readings
        customPrompt,
        includeWeather
      );
      
      // Replace loading message with response
      const aiMessage: ChatMessage = {
        text: response.insights,
        isUser: false,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev.slice(0, -1), aiMessage]);
    } catch (err) {
      console.error('Error fetching insights:', err);
      
      // Replace loading message with error
      const errorMessage: ChatMessage = {
        text: 'Sorry, I encountered an error analyzing your question. Please try again.',
        isUser: false,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatMessageText = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <p key={index} className={index === 0 ? 'mt-0' : 'mt-2'}>{paragraph}</p>
    ));
  };

  return (
    <div className="container py-8 h-screen flex flex-col">
      <h1 className="text-3xl font-bold mb-6">AI Agricultural Assistant</h1>
      
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
          <div className="flex items-center ml-2">
            <input 
              type="checkbox" 
              id="includeWeather" 
              checked={includeWeather}
              onChange={(e) => setIncludeWeather(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="includeWeather" className="text-sm">
              Include Weather
            </label>
          </div>
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