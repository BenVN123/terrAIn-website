import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { lusolve, matrix, Matrix } from "mathjs";

// Utility function to merge Tailwind CSS classes
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Hash sensor_node ID to a consistent HSL color
export function hashIdToColor(id: number): string {
  const hue = id % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Gaussian Radial Basis Function (RBF)
export function gaussianRBF(r: number, epsilon = 1): number {
  return -((epsilon * r) ** 2);
}

// Euclidean distance between two points
export function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Compute RBF interpolator function based on given points and values
export function computeRBFInterpolator(
  points: [number, number][], 
  values: number[], 
  epsilon = 1
): (x: number, y: number) => number {
  const N = points.length;
  
  // Need at least 2 points for interpolation
  if (N < 2) {
    throw new Error("RBF interpolation requires at least 2 points");
  }
  
  const phi: number[][] = Array.from({ length: N }, () => new Array(N));
  
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      phi[i][j] = gaussianRBF(euclidean(xi, yi, xj, yj), epsilon);
    }
  }

  const w = lusolve(phi, values);

  return function(x: number, y: number): number {
    let z = 0;
    for (let i = 0; i < N; i++) {
      const [xi, yi] = points[i];
        const weight = (w as number[][])[i][0];
        z += weight * gaussianRBF(euclidean(x, y, xi, yi), epsilon);

    }
    return z;
  };
}

