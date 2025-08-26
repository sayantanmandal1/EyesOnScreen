/**
 * DownloadUtils - Utility functions for downloading exported data
 * Handles browser download triggers and file management
 */

import { ExportResult } from './ExportManager';

export class DownloadUtils {
  /**
   * Trigger download of export result in the browser
   */
  static downloadExportResult(exportResult: ExportResult): void {
    const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
    this.downloadBlob(blob, exportResult.filename);
  }

  /**
   * Download a blob as a file
   */
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      // Clean up the object URL
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Download text content as a file
   */
  static downloadText(content: string, filename: string, mimeType: string = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  /**
   * Download JSON data as a file
   */
  static downloadJSON(data: any, filename: string): void {
    const jsonString = JSON.stringify(data, null, 2);
    this.downloadText(jsonString, filename, 'application/json');
  }

  /**
   * Download CSV data as a file
   */
  static downloadCSV(csvData: string[][], filename: string): void {
    const csvString = csvData.map(row => 
      row.map(cell => 
        typeof cell === 'string' && cell.includes(',') 
          ? `"${cell.replace(/"/g, '""')}"` 
          : cell
      ).join(',')
    ).join('\n');
    
    this.downloadText(csvString, filename, 'text/csv');
  }

  /**
   * Create a shareable link for export data (using data URLs)
   */
  static createShareableLink(exportResult: ExportResult): string {
    const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Copy export data to clipboard (for small exports)
   */
  static async copyToClipboard(exportResult: ExportResult): Promise<boolean> {
    if (typeof exportResult.data !== 'string') {
      console.warn('Cannot copy binary data to clipboard');
      return false;
    }

    if (exportResult.size > 1024 * 1024) { // 1MB limit
      console.warn('Export data too large for clipboard');
      return false;
    }

    try {
      await navigator.clipboard.writeText(exportResult.data);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Get file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Validate filename for download
   */
  static sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }

  /**
   * Generate timestamp-based filename
   */
  static generateTimestampFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0]; // Remove milliseconds
    
    return `${prefix}_${timestamp}.${extension}`;
  }

  /**
   * Check if browser supports file downloads
   */
  static supportsDownload(): boolean {
    return typeof document !== 'undefined' && 
           typeof URL !== 'undefined' && 
           typeof URL.createObjectURL === 'function';
  }

  /**
   * Check if browser supports clipboard API
   */
  static supportsClipboard(): boolean {
    return typeof navigator !== 'undefined' && 
           typeof navigator.clipboard !== 'undefined' &&
           typeof navigator.clipboard.writeText === 'function';
  }

  /**
   * Batch download multiple export results
   */
  static async batchDownload(exportResults: ExportResult[], delay: number = 100): Promise<void> {
    for (let i = 0; i < exportResults.length; i++) {
      this.downloadExportResult(exportResults[i]);
      
      // Add delay between downloads to avoid browser blocking
      if (i < exportResults.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Create a ZIP-like structure for multiple files (simplified)
   */
  static createMultiFileDownload(files: Array<{ name: string; content: string; mimeType: string }>): ExportResult {
    // This is a simplified implementation - in a real app you might use JSZip
    const combinedContent = files.map(file => 
      `=== ${file.name} ===\n${file.content}\n\n`
    ).join('');

    return {
      data: combinedContent,
      filename: `multi_file_export_${Date.now()}.txt`,
      mimeType: 'text/plain',
      size: new Blob([combinedContent]).size,
    };
  }

  /**
   * Preview export data (for debugging/testing)
   */
  static previewExportResult(exportResult: ExportResult): void {
    console.group(`Export Preview: ${exportResult.filename}`);
    console.log('MIME Type:', exportResult.mimeType);
    console.log('Size:', this.formatFileSize(exportResult.size));
    
    if (typeof exportResult.data === 'string') {
      console.log('Content Preview:', exportResult.data.substring(0, 500) + '...');
    } else {
      console.log('Binary data, length:', exportResult.data.length);
    }
    
    console.groupEnd();
  }
}