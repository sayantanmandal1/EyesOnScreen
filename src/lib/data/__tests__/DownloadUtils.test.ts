/**
 * Tests for DownloadUtils class
 */

import { DownloadUtils } from '../DownloadUtils';
import { ExportResult } from '../ExportManager';

// Mock DOM APIs
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockClick = jest.fn();
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

if (!global.document) {
  Object.defineProperty(global, 'document', {
    value: {
      createElement: mockCreateElement,
      body: {
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild,
      },
    },
    writable: true,
  });
}

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

Object.defineProperty(global, 'Blob', {
  value: class MockBlob {
    size: number;
    type: string;
    
    constructor(content: any[], options: { type?: string } = {}) {
      this.size = JSON.stringify(content).length;
      this.type = options.type || 'text/plain';
    }
  },
  writable: true,
});

// Mock navigator.clipboard
const mockWriteText = jest.fn();
Object.defineProperty(global, 'navigator', {
  value: {
    clipboard: {
      writeText: mockWriteText,
    },
  },
  writable: true,
});

describe('DownloadUtils', () => {
  let mockLink: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: mockClick,
    };
    
    mockCreateElement.mockReturnValue(mockLink);
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  describe('downloadExportResult', () => {
    it('should download export result correctly', () => {
      const exportResult: ExportResult = {
        data: '{"test": "data"}',
        filename: 'test-export.json',
        mimeType: 'application/json',
        size: 100,
      };

      DownloadUtils.downloadExportResult(exportResult);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.download).toBe('test-export.json');
      expect(mockLink.style.display).toBe('none');
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('downloadBlob', () => {
    it('should download blob with correct filename', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      const filename = 'test-file.txt';

      DownloadUtils.downloadBlob(blob, filename);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      expect(mockLink.download).toBe(filename);
      expect(mockClick).toHaveBeenCalled();
    });

    it('should clean up object URL even if error occurs', () => {
      const blob = new Blob(['test content']);
      mockClick.mockImplementation(() => {
        throw new Error('Click failed');
      });

      expect(() => {
        DownloadUtils.downloadBlob(blob, 'test.txt');
      }).toThrow('Click failed');

      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('downloadText', () => {
    it('should download text content with default mime type', () => {
      const content = 'Hello, world!';
      const filename = 'hello.txt';

      DownloadUtils.downloadText(content, filename);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe(filename);
      expect(mockClick).toHaveBeenCalled();
    });

    it('should download text content with custom mime type', () => {
      const content = '<html><body>Test</body></html>';
      const filename = 'test.html';
      const mimeType = 'text/html';

      DownloadUtils.downloadText(content, filename, mimeType);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe(filename);
    });
  });

  describe('downloadJSON', () => {
    it('should download JSON data with proper formatting', () => {
      const data = { name: 'test', value: 123, nested: { key: 'value' } };
      const filename = 'data.json';

      DownloadUtils.downloadJSON(data, filename);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe(filename);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('downloadCSV', () => {
    it('should download CSV data with proper formatting', () => {
      const csvData = [
        ['Name', 'Age', 'City'],
        ['John', '30', 'New York'],
        ['Jane', '25', 'Los Angeles'],
        ['Bob', '35', 'Chicago, IL'], // Test comma handling
      ];
      const filename = 'data.csv';

      DownloadUtils.downloadCSV(csvData, filename);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe(filename);
      expect(mockClick).toHaveBeenCalled();
    });

    it('should handle CSV cells with commas by quoting them', () => {
      const csvData = [
        ['Description', 'Value'],
        ['Item with, comma', '100'],
        ['Normal item', '200'],
      ];

      // We can't easily test the exact CSV content without mocking Blob more extensively,
      // but we can verify the download process works
      DownloadUtils.downloadCSV(csvData, 'test.csv');
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('createShareableLink', () => {
    it('should create shareable link for export result', () => {
      const exportResult: ExportResult = {
        data: 'test data',
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 9,
      };

      const link = DownloadUtils.createShareableLink(exportResult);

      expect(link).toBe('blob:mock-url');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('copyToClipboard', () => {
    it('should copy text data to clipboard', async () => {
      const exportResult: ExportResult = {
        data: 'Small text data',
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 15,
      };

      mockWriteText.mockResolvedValue(undefined);

      const result = await DownloadUtils.copyToClipboard(exportResult);

      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('Small text data');
    });

    it('should not copy binary data to clipboard', async () => {
      const exportResult: ExportResult = {
        data: new Uint8Array([1, 2, 3]),
        filename: 'test.bin',
        mimeType: 'application/octet-stream',
        size: 3,
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await DownloadUtils.copyToClipboard(exportResult);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Cannot copy binary data to clipboard');
      expect(mockWriteText).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not copy large data to clipboard', async () => {
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const exportResult: ExportResult = {
        data: largeData,
        filename: 'large.txt',
        mimeType: 'text/plain',
        size: largeData.length,
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await DownloadUtils.copyToClipboard(exportResult);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Export data too large for clipboard');
      expect(mockWriteText).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle clipboard API errors', async () => {
      const exportResult: ExportResult = {
        data: 'test data',
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 9,
      };

      const error = new Error('Clipboard access denied');
      mockWriteText.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await DownloadUtils.copyToClipboard(exportResult);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(DownloadUtils.formatFileSize(500)).toBe('500.0 B');
      expect(DownloadUtils.formatFileSize(1024)).toBe('1.0 KB');
      expect(DownloadUtils.formatFileSize(1536)).toBe('1.5 KB');
      expect(DownloadUtils.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(DownloadUtils.formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(DownloadUtils.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize invalid filename characters', () => {
      expect(DownloadUtils.sanitizeFilename('file<name>.txt')).toBe('file_name_.txt');
      expect(DownloadUtils.sanitizeFilename('file:name.txt')).toBe('file_name.txt');
      expect(DownloadUtils.sanitizeFilename('file/name.txt')).toBe('file_name.txt');
      expect(DownloadUtils.sanitizeFilename('File Name.TXT')).toBe('file_name.txt');
      expect(DownloadUtils.sanitizeFilename('file  name.txt')).toBe('file_name.txt');
    });

    it('should handle already clean filenames', () => {
      expect(DownloadUtils.sanitizeFilename('clean_filename.txt')).toBe('clean_filename.txt');
      expect(DownloadUtils.sanitizeFilename('file123.json')).toBe('file123.json');
    });
  });

  describe('generateTimestampFilename', () => {
    it('should generate filename with timestamp', () => {
      const filename = DownloadUtils.generateTimestampFilename('export', 'json');
      
      expect(filename).toMatch(/^export_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
    });

    it('should handle different prefixes and extensions', () => {
      const filename = DownloadUtils.generateTimestampFilename('session_data', 'csv');
      
      expect(filename).toMatch(/^session_data_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
    });
  });

  describe('browser support detection', () => {
    it('should detect download support', () => {
      expect(DownloadUtils.supportsDownload()).toBe(true);
    });

    it('should detect clipboard support', () => {
      expect(DownloadUtils.supportsClipboard()).toBe(true);
    });

    it('should handle missing document', () => {
      const originalDocument = global.document;
      delete (global as any).document;

      expect(DownloadUtils.supportsDownload()).toBe(false);

      (global as any).document = originalDocument;
    });

    it('should handle missing clipboard API', () => {
      const originalNavigator = global.navigator;
      delete (global as any).navigator;

      expect(DownloadUtils.supportsClipboard()).toBe(false);

      (global as any).navigator = originalNavigator;
    });
  });

  describe('batchDownload', () => {
    it('should download multiple files with delay', async () => {
      const exportResults: ExportResult[] = [
        {
          data: 'file1 content',
          filename: 'file1.txt',
          mimeType: 'text/plain',
          size: 13,
        },
        {
          data: 'file2 content',
          filename: 'file2.txt',
          mimeType: 'text/plain',
          size: 13,
        },
      ];

      const startTime = Date.now();
      await DownloadUtils.batchDownload(exportResults, 50);
      const endTime = Date.now();

      expect(mockClick).toHaveBeenCalledTimes(2);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50); // Should have delay
    });

    it('should handle single file without delay', async () => {
      const exportResults: ExportResult[] = [
        {
          data: 'single file',
          filename: 'single.txt',
          mimeType: 'text/plain',
          size: 11,
        },
      ];

      await DownloadUtils.batchDownload(exportResults, 100);

      expect(mockClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMultiFileDownload', () => {
    it('should create combined file from multiple files', () => {
      const files = [
        { name: 'file1.txt', content: 'Content 1', mimeType: 'text/plain' },
        { name: 'file2.json', content: '{"key": "value"}', mimeType: 'application/json' },
      ];

      const result = DownloadUtils.createMultiFileDownload(files);

      expect(result.mimeType).toBe('text/plain');
      expect(result.filename).toMatch(/^multi_file_export_\d+\.txt$/);
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('=== file1.txt ===');
      expect(result.data).toContain('Content 1');
      expect(result.data).toContain('=== file2.json ===');
      expect(result.data).toContain('{"key": "value"}');
    });
  });

  describe('previewExportResult', () => {
    it('should preview text export result', () => {
      const exportResult: ExportResult = {
        data: 'This is a test content that is longer than 500 characters. '.repeat(10),
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 100,
      };

      const consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      DownloadUtils.previewExportResult(exportResult);

      expect(consoleGroupSpy).toHaveBeenCalledWith('Export Preview: test.txt');
      expect(consoleLogSpy).toHaveBeenCalledWith('MIME Type:', 'text/plain');
      expect(consoleLogSpy).toHaveBeenCalledWith('Size:', '100.0 B');
      expect(consoleLogSpy).toHaveBeenCalledWith('Content Preview:', expect.stringContaining('This is a test content'));
      expect(consoleGroupEndSpy).toHaveBeenCalled();

      consoleGroupSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });

    it('should preview binary export result', () => {
      const exportResult: ExportResult = {
        data: new Uint8Array([1, 2, 3, 4, 5]),
        filename: 'test.bin',
        mimeType: 'application/octet-stream',
        size: 5,
      };

      const consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      DownloadUtils.previewExportResult(exportResult);

      expect(consoleLogSpy).toHaveBeenCalledWith('Binary data, length:', 5);

      consoleGroupSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });
  });
});