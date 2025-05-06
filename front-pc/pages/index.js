import React, { useState } from 'react';
import { MdPictureAsPdf } from 'react-icons/md';
import { AiOutlineDownload } from 'react-icons/ai';

export default function Home() {
  const [selector, setSelector] = useState('');
  const [pdfOutput, setPdfOutput] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConvertToPdf = async () => {
    if (!websiteUrl) {
      alert('Please enter a valid website URL.');
      return;
    }

    setIsLoading(true);
    try {
      // convert pdf
      const response = await fetch('/api/convert-to-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, websiteUrl, selector }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(
          'Error converting website to PDF: ' +
            (error.error || response.statusText)
        );
        return;
      }
      const result = await response.json();
      setPdfOutput(result.pdfUrl);
      alert('PDF generated successfully! You can download it below.');
    } catch (error) {
      alert('Error converting website to PDF: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePdfOutputChange = (e) => {
    setPdfOutput(e.target.value);
  };

  const handleSelectorChange = (e) => {
    setSelector(e.target.value);
  };

  const handleWebsiteUrlChange = (e) => {
    setWebsiteUrl(e.target.value);
  };

  const handleLoginRequiredChange = (e) => {
    if (e) {
      setWebsiteUrl('https://job.icbc.com.cn/pc/index.html#/main/home');
      setSelector('.right___1-Ni0 > .content__right___1mc2_');
    } else {
      setWebsiteUrl('');
      setSelector('');
    }
    setLoginRequired(e);
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const downLoadPdf = () => {
    if (!pdfOutput) return;
    const link = document.createElement('a');
    link.href = pdfOutput;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `${timestamp}.pdf`;
    link.click();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <script
        src="/vendors.async.js"
        onLoad={() => {
          console.log('vendors.async.js 已加载完成');
          // 如果该脚本暴露了全局变量或函数，可以在这里调用
        }}
      />
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        Convert Website to PDF
      </h1>
      <input
        type="text"
        value={websiteUrl}
        onChange={handleWebsiteUrlChange}
        placeholder="Enter website URL"
        className="border border-gray-300 rounded-lg p-3 mb-4 w-full max-w-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
      />
      <input
        type="text"
        value={selector}
        onChange={handleSelectorChange}
        placeholder="Enter CSS selector (e.g. #content)"
        className="border border-gray-300 rounded-lg p-3 mb-4 w-full max-w-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
      />
      <div className="border border-gray-300 rounded-lg p-4 mb-4 w-full max-w-md bg-gray-50">
        <label className="flex items-center p-2 space-x-2 cursor-pointer">
          <input
            type="radio"
            name="loginOption"
            value="true"
            checked={loginRequired}
            onChange={(e) =>
              handleLoginRequiredChange(e.target.value === 'true')
            }
          />
          need Logon(ICBC)
        </label>
        <label className="flex items-center p-2 space-x-2 cursor-pointer">
          <input
            type="radio"
            name="loginOption"
            value="false"
            checked={!loginRequired}
            onChange={(e) =>
              handleLoginRequiredChange(e.target.value === 'true')
            }
          />
          no Logon
        </label>
      </div>
      {loginRequired && (
        <>
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="Enter username"
            className="border border-gray-300 rounded-lg p-3 mb-4 w-full max-w-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Enter password"
            className="border border-gray-300 rounded-lg p-3 mb-4 w-full max-w-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </>
      )}
      <button
        onClick={handleConvertToPdf}
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 px-6 flex items-center disabled:opacity-50 transition-colors shadow-md hover:shadow-lg"
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            生成中...
          </span>
        ) : (
          <>
            HTML DIV PDF
            <MdPictureAsPdf className="h-6 w-6 ml-2" />
          </>
        )}
      </button>
      <textarea
        value={pdfOutput}
        onChange={handlePdfOutputChange}
        placeholder="PDF output url will appear here"
        className="border border-gray-300 rounded-lg p-3 mt-4 w-full max-w-md h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
      />
      <button
        onClick={downLoadPdf}
        className="bg-green-600 hover:bg-green-700 text-white rounded-lg py-3 px-6 flex items-center transition-colors shadow-md hover:shadow-lg"
      >
        DOWNLOAD PDF
        <AiOutlineDownload className="h-6 w-6 ml-2" />
      </button>
    </div>
  );
}
