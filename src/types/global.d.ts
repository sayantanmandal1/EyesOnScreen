/// <reference types="react" />
/// <reference types="react-dom" />

import 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}