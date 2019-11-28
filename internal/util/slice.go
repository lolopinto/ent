package util

import "sort"

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

func StringsEqual(slice, slice2 []string) bool {
	if len(slice) != len(slice2) {
		return false
	}
	slice = sort.StringSlice(slice)
	slice2 = sort.StringSlice(slice2)
	for idx, item := range slice {
		if item != slice2[idx] {
			return false
		}
	}
	return true
}
