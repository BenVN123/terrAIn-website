import numpy as np
import matplotlib.pyplot as plt
from scipy.spatial import procrustes
from mpl_toolkits.mplot3d import Axes3D

def compute_distances_from_coords(coords):
    """
    Given a dictionary of coordinates in 3D, compute the full pairwise distance dictionary.
    
    Parameters:
        coords (dict): A dictionary mapping node labels to a tuple of (x, y, z)
        
    Returns:
        dict: A nested dictionary where d[i][j] is the Euclidean distance between node i and node j.
    """
    nodes = sorted(coords.keys())
    n = len(nodes)
    D = np.zeros((n, n))
    for i in nodes:
        for j in nodes:
            xi = np.array(coords[i])
            xj = np.array(coords[j])
            D[i, j] = np.linalg.norm(xi - xj)
            
    dist_dict = {}
    for i in nodes:
        dist_dict[i] = {}
        for j in nodes:
            if i != j:
                dist_dict[i][j] = D[i, j]
    return dist_dict

def dist_2_euclid(distances, dim=3):
    """
    Converts a dictionary of pairwise distances into coordinates in a Euclidean space using Classical MDS.
    
    Parameters:
        distances (dict): A dictionary where distances[i][j] is the distance between node i and node j.
        dim (int): The target embedding dimension (default is 3).
    
    Returns:
        np.ndarray: An array of shape (n, dim) with the coordinates for each node.
    """
    nodes = sorted(distances.keys())
    n = len(nodes)
    D = np.zeros((n, n))
    for i in nodes:
        for j in nodes:
            if i == j:
                D[i, j] = 0.0
            else:
                dij = distances[i].get(j, None)
                dji = distances[j].get(i, None)
                if dij is not None and dji is not None:
                    D[i, j] = (dij + dji) / 2.0
                elif dij is not None:
                    D[i, j] = dij
                elif dji is not None:
                    D[i, j] = dji

    D_sq = D**2
    J = np.eye(n) - np.ones((n, n)) / n
    B = -0.5 * J.dot(D_sq).dot(J)
    eigvals, eigvecs = np.linalg.eigh(B)
    idx = np.argsort(eigvals)[::-1]
    eigvals = eigvals[idx]
    eigvecs = eigvecs[:, idx]
    L = np.diag(np.sqrt(eigvals[:dim]))
    X = eigvecs[:, :dim].dot(L)
    return X

if __name__ == "__main__":
    node_positions = {
        0: (0, 0, 0),
        1: (10, 0, 0),
        2: (0, 10, 0),
        3: (10, 10, 0),
        4: (5, 5, 0)
    }
    print("Actual 3D coordinates:", node_positions)
    distances = compute_distances_from_coords(node_positions)
    # print("distances:", dis)
    actual_coords = np.array([node_positions[i] for i in sorted(node_positions.keys())])
    mds_coords = dist_2_euclid(distances, dim=3)

    print("MDS coords:", mds_coords)
    
    mtx1, mtx2, disparity = procrustes(actual_coords, mds_coords)
    print("Procrustes disparity (error measure):", disparity)
    fig_actual = plt.figure(figsize=(8, 6))
    ax_actual = fig_actual.add_subplot(111, projection='3d')
    ax_actual.scatter(actual_coords[:, 0], actual_coords[:, 1], actual_coords[:, 2],
                      c='blue', label='Actual Positions', s=100, marker='o')
    for i, (x, y, z) in enumerate(actual_coords):
        ax_actual.text(x, y, z, f' {i}', fontsize=12, color='blue')
    ax_actual.set_title("Actual 3D Coordinates")
    ax_actual.set_xlabel("X")
    ax_actual.set_ylabel("Y")
    ax_actual.set_zlabel("Z")
    ax_actual.legend()
    plt.savefig("actual_coords.png")
    plt.tight_layout()
    fig_mds = plt.figure(figsize=(8, 6))
    ax_mds = fig_mds.add_subplot(111, projection='3d')
    ax_mds.scatter(mtx2[:, 0], mtx2[:, 1], mtx2[:, 2],
                   c='red', label='MDS Positions (aligned)', s=100, marker='^')
    for i, (x, y, z) in enumerate(mtx2):
        ax_mds.text(x, y, z, f' {i}', fontsize=12, color='red')
    ax_mds.set_title("Estimated 3D Coordinates from MDS (after Procrustes Alignment)")
    ax_mds.set_xlabel("X")
    ax_mds.set_ylabel("Y")
    ax_mds.set_zlabel("Z")
    ax_mds.legend()
    plt.tight_layout()
    plt.savefig("proscrutes_coords.png")
    plt.show()



from mpl_toolkits.mplot3d import Axes3D  # Required for 3D plotting

fig = plt.figure(figsize=(8, 6))
ax = fig.add_subplot(111, projection='3d')

# Plot the aligned MDS points in 3D
ax.scatter(mtx2[:, 0], mtx2[:, 1], mtx2[:, 2],
           c='red', marker='^', label='Aligned MDS Points')
for i, (x, y, z) in enumerate(mtx2):
    ax.text(x, y, z, f' {i}', fontsize=12, color='red')

# Optionally, plot the actual 3D coordinates
ax.scatter(actual_coords[:, 0], actual_coords[:, 1], actual_coords[:, 2],
           c='blue', marker='o', label='Actual Positions')
for i, (x, y, z) in enumerate(actual_coords):
    ax.text(x, y, z, f' {i}', fontsize=12, color='blue')

ax.set_title("Aligned 3D MDS Coordinates vs Actual 3D Positions")
ax.set_xlabel("X")
ax.set_ylabel("Y")
ax.set_zlabel("Z")
ax.legend()
plt.tight_layout()
plt.savefig("mds_vs_actual.png")
plt.show()