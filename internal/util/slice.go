package util

// https://github.com/golang/go/wiki/SliceTricks#filtering-without-allocating
func FilterSlice(slice []string, filterFunc func(string) bool) []string {
	result := slice[:0]
	for _, item := range slice {
		if filterFunc(item) {
			result = append(result, item)
		}
	}
	return result
}
