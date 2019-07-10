package configs

// AssocEdgeConfig is configuration used to configure edges in the ent-framework
type AssocEdgeConfig struct {
	EdgeType        string `db:"edge_type"`
	EdgeName        string `db:"edge_type"`
	SymmetricEdge   bool   `db:"symmetric_edge"`
	InverseEdgeType string `db:"inverse_edge_type"`
	EdgeTable       string `db:"edge_table"`
}

// GetTableName returns the underyling database table the model's data is stored
func (config *AssocEdgeConfig) GetTableName() string {
	return "assoc_edge_config"
}
